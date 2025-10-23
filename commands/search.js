import { Markup } from "telegraf";
import {
  buildCategoriesKeyboard,
  buildVolumeSelectionKeyboard,
} from "./keyboards.js";
import { sendProductWithPhoto } from "./utils.js";

export function registerSearchHandlers(
  bot,
  state,
  searchState,
  searchResults,
  userCarts
) {
  bot.action("search", async (ctx) => {
    await ctx.answerCbQuery();
    searchState.set(ctx.from.id, { waitingForQuery: true });
    try {
      await ctx.editMessageText(
        "🔍 Введите название товара для поиска:",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Отменить", "cancel_search")],
        ])
      );
    } catch {
      await ctx.reply(
        "🔍 Введите название товара для поиска:",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Отменить", "cancel_search")],
        ])
      );
    }
  });

  bot.action("cancel_search", async (ctx) => {
    searchState.delete(ctx.from.id);
    try {
      await ctx.editMessageText("Выберите категорию:", {
        reply_markup: buildCategoriesKeyboard(
          state.categories,
          state.products,
          1
        ).reply_markup,
      });
    } catch {
      await ctx.reply(
        "Выберите категорию:",
        buildCategoriesKeyboard(state.categories, state.products, 1)
      );
    }
    await ctx.answerCbQuery();
  });

  bot.action(/^search_product_(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const prod = state.products.find((p) => String(p.id) === String(id));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    // Показываем товар с выбором объема
    const kb = buildVolumeSelectionKeyboard(prod, 1, "search");
    await sendProductWithPhoto(ctx, prod, kb, true);
    await ctx.answerCbQuery();
  });

  bot.action("back_to_search", async (ctx) => {
    const savedSearch = searchResults.get(ctx.from.id);
    if (!savedSearch) {
      await ctx.answerCbQuery(
        "Результаты поиска устарели. Используйте /catalog",
        { show_alert: true }
      );
      return;
    }
    const { results, query } = savedSearch;
    const text = `Найдено товаров: ${results.length}\n\nВыберите товар:`;
    const keyboard = results.map((prod) => {
      let priceText = "";
      if (prod.prices && Array.isArray(prod.prices) && prod.prices.length > 0) {
        if (prod.prices.length === 1) {
          priceText = prod.prices[0].price;
        } else {
          priceText = `от ${prod.prices[0].price}`;
        }
      } else if (prod.price) {
        priceText = prod.price;
      }
      return [
        Markup.button.callback(
          `${prod.title}${priceText ? ` — ${priceText}` : ""}`,
          `search_product_${prod.id}`
        ),
      ];
    });
    keyboard.push([
      Markup.button.callback("⬅️ Назад к категориям", "show_categories"),
    ]);
    // Всегда создаем новое сообщение для сохранения истории
    await ctx.reply(text, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  });
}
