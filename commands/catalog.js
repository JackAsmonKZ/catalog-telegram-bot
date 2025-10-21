import { Markup } from "telegraf";
import {
  buildCatalogKeyboard,
  getProductKeyboard,
  buildMainKeyboard,
} from "./keyboards.js";
import {
  getCart,
  isAdmin,
  saveProducts,
  sendProductWithPhoto,
  generateNewProductId,
} from "./utils.js";
import { showCatalog, showCart } from "./catalogHandlers.js";
import { registerAdminHandlers } from "../admin.js";
import { registerCartHandlers } from "./cart.js";
import { registerSearchHandlers } from "./search.js";

export { buildMainKeyboard };

export function registerCatalogHandlers(bot, state, dbPath, ADMIN_ID) {
  const searchState = new Map();
  const searchResults = new Map();
  const userCarts = new Map();
  const adminState = new Map();

  registerAdminHandlers(bot, state, dbPath, ADMIN_ID, adminState);
  registerCartHandlers(bot, state, userCarts, ADMIN_ID);
  registerSearchHandlers(bot, state, searchState, searchResults, userCarts);

  bot.command("catalog", (ctx) => {
    showCatalog(ctx, state, 1);
  });

  bot.action(/^page_(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    try {
      await ctx.editMessageText("Каталог товаров:", {
        reply_markup: buildCatalogKeyboard(state.products, page).reply_markup,
      });
      await ctx.answerCbQuery();
    } catch {
      await ctx.reply(
        "Каталог товаров:",
        buildCatalogKeyboard(state.products, page)
      );
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^catalog_back_(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    // Всегда создаем новое сообщение каталога для сохранения истории
    await ctx.reply(
      "Каталог товаров:",
      buildCatalogKeyboard(state.products, page)
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^product_(.+)_p(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const page = Number(ctx.match[2]);
    const prod = state.products.find((p) => String(p.id) === String(id));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const cart = getCart(userCarts, ctx.from.id);
    const kb = getProductKeyboard(prod.id, page, cart, "catalog");
    await sendProductWithPhoto(ctx, prod, kb, true);
    await ctx.answerCbQuery();
  });

  bot.on("text", async (ctx, next) => {
    const text = String(ctx.message.text).trim();
    if (text === "📦 Каталог" || text.toLowerCase() === "каталог") {
      await showCatalog(ctx, state, 1);
      return;
    }
    if (text === "🛒 Корзина" || text.toLowerCase() === "корзина") {
      await showCart(ctx, state, userCarts);
      return;
    }
    // Админские кнопки
    if (text === "➕ Добавить товар") {
      if (!isAdmin(ADMIN_ID, ctx)) {
        await ctx.reply("⛔️ Эта функция доступна только администратору.");
        return;
      }
      adminState.set(ctx.from.id, { awaiting_add: true });
      await ctx.reply(
        'Пришли JSON товара в формате (ID назначится автоматически):\n{"title":"...","price":"...","description":"...","photo":"..."}\n\nПоле photo необязательное.'
      );
      return;
    }
    if (text === "📝 Управление") {
      if (!isAdmin(ADMIN_ID, ctx)) {
        await ctx.reply("⛔️ Эта функция доступна только администратору.");
        return;
      }
      if (state.products.length === 0) {
        await ctx.reply(
          "Каталог пуст. Добавьте товары через кнопку ➕ Добавить товар"
        );
        return;
      }
      const keyboard = state.products.map((p) => [
        Markup.button.callback(`✏️ ${p.title}`, `admin_edit_${p.id}`),
        Markup.button.callback(`🗑 ${p.title}`, `admin_delete_${p.id}`),
      ]);
      await ctx.reply(
        "Выберите товар для редактирования или удаления:",
        Markup.inlineKeyboard(keyboard)
      );
      return;
    }
    const adminSt = adminState.get(ctx.from.id);
    if (adminSt?.awaiting_add && isAdmin(ADMIN_ID, ctx)) {
      adminState.delete(ctx.from.id);
      try {
        const obj = JSON.parse(ctx.message.text);
        if (!obj.title) {
          await ctx.reply("Нужно минимум поле title.");
          return;
        }
        // Генерируем новый ID автоматически
        const newId = generateNewProductId(state.products);
        const newProduct = {
          id: newId,
          ...obj,
        };
        state.products.push(newProduct);
        await saveProducts(dbPath, state.products);
        await ctx.reply(
          `✅ Товар добавлен с ID: ${newId}\n\n${JSON.stringify(
            newProduct,
            null,
            2
          )}`
        );
      } catch {
        await ctx.reply("Ошибка парсинга JSON. Убедись, что формат верный.");
      }
      return;
    }
    if (adminSt?.awaiting_edit && isAdmin(ADMIN_ID, ctx)) {
      const editId = adminSt.awaiting_edit;
      adminState.delete(ctx.from.id);
      try {
        const obj = JSON.parse(ctx.message.text);
        if (!obj.title) {
          await ctx.reply("Нужно минимум поле title.");
          return;
        }
        const idx = state.products.findIndex(
          (p) => String(p.id) === String(editId)
        );
        if (idx === -1) {
          await ctx.reply("Исходный товар не найден.");
          return;
        }
        // Сохраняем ID и обновляем остальные поля
        state.products[idx] = {
          id: editId,
          ...obj,
        };
        await saveProducts(dbPath, state.products);
        await ctx.reply(
          `✅ Товар обновлён:\n\n${JSON.stringify(
            state.products[idx],
            null,
            2
          )}`
        );
      } catch {
        await ctx.reply("Ошибка парсинга JSON. Убедись, что формат верный.");
      }
      return;
    }
    if (adminSt?.awaiting_delete && isAdmin(ADMIN_ID, ctx)) {
      adminState.delete(ctx.from.id);
      const id = ctx.message.text.trim();
      const idx = state.products.findIndex((p) => String(p.id) === String(id));
      if (idx === -1) {
        await ctx.reply("Товар не найден.");
        return;
      }
      state.products.splice(idx, 1);
      await saveProducts(dbPath, state.products);
      await ctx.reply("Товар удалён.");
      return;
    }
    const userState = searchState.get(ctx.from.id);
    if (!userState?.waitingForQuery) {
      return next();
    }
    searchState.delete(ctx.from.id);
    const query = ctx.message.text.toLowerCase().trim();
    const results = state.products.filter(
      (p) =>
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
    if (results.length === 0) {
      await ctx.reply(
        `По запросу "${ctx.message.text}" ничего не найдено.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Вернуться в каталог", "catalog_back_1")],
          [Markup.button.callback("🔍 Новый поиск", "search")],
        ])
      );
      return;
    }
    searchResults.set(ctx.from.id, { results, query: ctx.message.text });
    const textOut = `Найдено товаров: ${results.length}\n\nВыберите товар:`;
    const keyboard = results.map((prod) => [
      Markup.button.callback(
        `${prod.title} — ${prod.price || ""}`,
        `search_product_${prod.id}`
      ),
    ]);
    keyboard.push([
      Markup.button.callback("⬅️ Вернуться в каталог", "catalog_back_1"),
    ]);
    keyboard.push([Markup.button.callback("🔍 Новый поиск", "search")]);
    await ctx.reply(textOut, Markup.inlineKeyboard(keyboard));
  });
}
