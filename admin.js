import { Markup } from "telegraf";
import { isAdmin, saveProducts } from "./commands/utils.js";

export function registerAdminHandlers(
  bot,
  state,
  dbPath,
  ADMIN_ID,
  adminState
) {
  bot.command("add", (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      ctx.reply("Только админ.");
      return;
    }
    adminState.set(ctx.from.id, { awaiting_add: true });
    ctx.reply(
      'Пришли JSON товара в формате (ID назначится автоматически):\n{"title":"Название товара",\n"price":"Цена товара",\n"description":"Описание товара",\n"photo":"URL фото товара"}'
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

  bot.action(/^admin_delete_(.+)$/, async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.answerCbQuery("Только админ.", { show_alert: true });
      return;
    }
    const id = ctx.match[1];
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

  bot.action(/^admin_edit_(.+)$/, async (ctx) => {
    if (!isAdmin(ADMIN_ID, ctx)) {
      await ctx.answerCbQuery("Только админ.", { show_alert: true });
      return;
    }
    const id = ctx.match[1];
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
}
