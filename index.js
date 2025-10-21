import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import fs from "fs-extra";
import {
  buildCatalogKeyboard,
  getProductKeyboard,
} from "./commands/keyboards.js";
import {
  getCart,
  isAdmin,
  saveProducts,
  sendProductWithPhoto,
  generateNewProductId,
} from "./commands/utils.js";
import { registerAdminHandlers } from "./admin.js";
import { registerCartHandlers } from "./commands/cart.js";
import { registerSearchHandlers } from "./commands/search.js";
import { showCart, showCatalog } from "./commands/catalogHandlers.js";

// Загрузка переменных окружения
dotenv.config();

// Проверка наличия токена
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const dbPath = "./products.json";

if (!BOT_TOKEN) {
  console.error("❌ Ошибка: BOT_TOKEN не установлен в файле .env");
  process.exit(1);
}

if (!ADMIN_ID) {
  console.warn("⚠️ Предупреждение: ADMIN_ID не установлен в файле .env");
  console.warn(
    "   Уведомления о заказах не будут отправляться администратору."
  );
} else {
  console.log(`✅ ADMIN_ID установлен: ${ADMIN_ID}`);
}

// Создание экземпляра бота
const bot = new Telegraf(BOT_TOKEN);

// Инициализация состояния
const state = {
  products: [],
};

// Загрузка продуктов из файла
async function loadProducts() {
  try {
    if (await fs.pathExists(dbPath)) {
      const data = await fs.readJson(dbPath);
      state.products = Array.isArray(data) ? data : [];
      console.log(
        `✅ Загружено ${state.products.length} товаров из базы данных`
      );
    } else {
      await fs.writeJson(dbPath, []);
      console.log("✅ Создан новый файл базы данных");
    }
  } catch (error) {
    console.error("❌ Ошибка загрузки продуктов:", error);
    state.products = [];
  }
}

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
    if (text === "🔍 Поиск" || text.toLowerCase() === "поиск") {
      searchState.set(ctx.from.id, { waitingForQuery: true });
      await ctx.reply(
        "🔍 Введите название товара для поиска:",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Отменить", "cancel_search")],
        ])
      );
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

// Основная функция запуска бота
async function main() {
  try {
    // Загрузка продуктов
    await loadProducts();

    // Регистрация обработчиков
    registerCatalogHandlers(bot, state, dbPath, ADMIN_ID);

    // Команда /start
    bot.start((ctx) => {
      const isAdminUser = isAdmin(ADMIN_ID, ctx);

      let keyboard;
      if (isAdminUser) {
        // Клавиатура для админа
        keyboard = Markup.keyboard([
          ["📦 Каталог", "🛒 Корзина"],
          ["🔍 Поиск"],
          ["➕ Добавить товар", "📝 Управление"],
        ]).resize();
      } else {
        // Обычная клавиатура
        keyboard = Markup.keyboard([
          ["📦 Каталог", "🛒 Корзина"],
          ["🔍 Поиск"],
        ]).resize();
      }

      const message = isAdminUser
        ? `Привет, ${ctx.from.first_name}! 👋\n\nЭто бот-каталог товаров.\n\n🔧 Режим администратора активен.`
        : `Привет, ${ctx.from.first_name}! 👋\n\nЭто бот-каталог товаров.\n\nИспользуй кнопки меню для навигации:`;

      ctx.reply(message, keyboard);
    });

    // Запуск бота
    await bot.launch();
    console.log("✅ Бот успешно запущен!");

    // Обработка остановки бота
    process.once("SIGINT", () => {
      console.log("\n⏹ Получен сигнал SIGINT, остановка бота...");
      bot.stop("SIGINT");
    });

    process.once("SIGTERM", () => {
      console.log("\n⏹ Получен сигнал SIGTERM, остановка бота...");
      bot.stop("SIGTERM");
    });
  } catch (error) {
    console.error("❌ Ошибка запуска бота:", error);
    process.exit(1);
  }
}

// Запуск приложения
main();
