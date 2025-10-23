import { Markup } from "telegraf";
import {
  isAdmin,
  saveProducts,
  saveCategories,
  generateNewCategoryId,
  deleteCategoryAndUpdateProducts,
} from "./commands/utils.js";

export function registerAdminHandlers(
  bot,
  state,
  dbPath,
  categoriesPath,
  ADMIN_ID,
  adminState
) {
  bot.command("add", (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      ctx.reply("Только админ.");
      return;
    }
    adminState.set(ctx.from.id, { awaiting_add: true });

    // Формируем список категорий
    let categoriesText = "\n\nДоступные категории:\n";
    state.categories.forEach((cat) => {
      categoriesText += `• ${cat.id} — ${cat.name}\n`;
    });

    ctx.reply(
      `Пришли JSON товара в формате (ID назначится автоматически):
{"title":"...","price":"...","description":"...","photo":"...","category":"ID_категории"}

Поля photo и category необязательные.${categoriesText}`
    );
  });

  bot.command("edit", async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      ctx.reply("Только админ.");
      return;
    }
    if (state.products.length === 0) {
      ctx.reply("Каталог пуст.");
      return;
    }
    const keyboard = state.products.map((p) => [
      Markup.button.callback(`✏️ ${p.title}`, `admin_edit_${p.id}`),
      Markup.button.callback(`🗑 ${p.title}`, `admin_delete_${p.id}`),
    ]);
    try {
      await ctx.reply(
        "Выберите товар для редактирования или удаления:",
        Markup.inlineKeyboard(keyboard)
      );
    } catch {
      await ctx.reply("Выберите товар для редактирования или удаления:");
    }
  });

  bot.command("delete", (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      ctx.reply("Только админ.");
      return;
    }
    adminState.set(ctx.from.id, { awaiting_delete: true });
    ctx.reply("Отправь id товара для удаления.");
  });

  // Удаление товаров (НЕ категорий - используем negative lookahead)
  bot.action(/^admin_delete_(?!cat_)(.+)$/, async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.answerCbQuery("Только админ.", { show_alert: true });
      return;
    }
    const id = ctx.match[1];
    console.log(`Удаление товара ID: ${id}`);
    const idx = state.products.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    state.products.splice(idx, 1);
    await saveProducts(dbPath, state.products);
    try {
      await ctx.editMessageText("Товар удалён");
    } catch {}
    await ctx.answerCbQuery("Удалено");
  });

  // Редактирование товаров (НЕ категорий - используем negative lookahead)
  bot.action(/^admin_edit_(?!cat_)(.+)$/, async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.answerCbQuery("Только админ.", { show_alert: true });
      return;
    }
    const id = ctx.match[1];
    console.log(`Редактирование товара ID: ${id}`);
    const prod = state.products.find((p) => String(p.id) === String(id));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    adminState.set(ctx.from.id, { awaiting_edit: id });
    await ctx.reply(
      `Отправь JSON с обновлённым товаром для ID=${id} (ID не изменится).\n\nТекущий объект:\n${JSON.stringify(
        prod,
        null,
        2
      )}\n\nМожешь отправить без поля "id", оно сохранится автоматически.`
    );
    await ctx.answerCbQuery();
  });

  bot.command("list", async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.reply("Только админ.");
      return;
    }
    if (state.products.length === 0) {
      await ctx.reply("Каталог пуст.");
      return;
    }
    let text = state.products.map((p) => `id: ${p.id} — ${p.title}`).join("\n");
    const keyboard = state.products.map((p) => [
      Markup.button.callback(`✏️ ${p.id}`, `admin_edit_${p.id}`),
      Markup.button.callback(`🗑 ${p.id}`, `admin_delete_${p.id}`),
    ]);
    try {
      await ctx.reply(text, Markup.inlineKeyboard(keyboard));
    } catch {
      await ctx.reply(text);
    }
  });

  // ==================== УПРАВЛЕНИЕ КАТЕГОРИЯМИ ====================

  bot.command("addcat", (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      ctx.reply("Только админ.");
      return;
    }
    adminState.set(ctx.from.id, { awaiting_add_category: true });
    ctx.reply(
      'Пришли JSON категории в формате (ID назначится автоматически):\n{"name":"Название категории"}'
    );
  });

  bot.command("listcat", async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.reply("Только админ.");
      return;
    }
    if (state.categories.length === 0) {
      await ctx.reply("Категорий нет.");
      return;
    }
    let text = state.categories
      .map((c) => {
        const count = state.products.filter(
          (p) => String(p.category) === String(c.id)
        ).length;
        return `ID: ${c.id} — ${c.name} (${count} товаров)`;
      })
      .join("\n");
    const keyboard = state.categories.map((c) => [
      Markup.button.callback(`🗑 ${c.name}`, `admin_delete_cat_${c.id}`),
    ]);
    try {
      await ctx.reply(
        `📋 Список категорий:\n\n${text}\n\nВыберите категорию для удаления:`,
        Markup.inlineKeyboard(keyboard)
      );
    } catch {
      await ctx.reply(text);
    }
  });

  // Обработчик удаления категорий
  bot.action(/^admin_delete_cat_(.+)$/, async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.answerCbQuery("Только админ.", { show_alert: true });
      return;
    }
    const id = ctx.match[1];
    console.log(`Удаление категории ID: ${id}`);

    const result = await deleteCategoryAndUpdateProducts(
      state.categories,
      state.products,
      id,
      categoriesPath,
      dbPath
    );

    console.log("Результат удаления:", result);

    if (result.success) {
      try {
        await ctx.editMessageText(result.message, {
          reply_markup: { inline_keyboard: [] },
        });
      } catch (err) {
        console.error("Ошибка при редактировании сообщения:", err.message);
        await ctx.reply(result.message);
      }
      await ctx.answerCbQuery("Удалено");
    } else {
      await ctx.answerCbQuery(result.message, { show_alert: true });
    }
  });
}
