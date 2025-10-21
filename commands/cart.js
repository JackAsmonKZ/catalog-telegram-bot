import { Markup } from "telegraf";
import { getCart } from "./utils.js";
import { getProductKeyboard, buildMainKeyboard } from "./keyboards.js";
import { showCart } from "./catalogHandlers.js";

export function registerCartHandlers(bot, state, userCarts, ADMIN_ID) {
  bot.action(/^add_to_cart_(.+)_(\d+)_(catalog|search)$/, async (ctx) => {
    const productId = ctx.match[1];
    const page = Number(ctx.match[2]);
    const source = ctx.match[3];
    const cart = getCart(userCarts, ctx.from.id);
    cart.set(productId, 1);
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const kb = getProductKeyboard(prod.id, page, cart, source);
    // Обновляем только клавиатуру (не удаляем сообщение)
    try {
      if (prod.photo && ctx.callbackQuery?.message?.photo) {
        // Если это сообщение с фото, обновляем caption и клавиатуру
        await ctx.editMessageCaption(
          `${prod.title}\n\n${
            prod.description || "Описание отсутствует"
          }\n\nЦена: ${prod.price || "по запросу"}`,
          { reply_markup: kb.reply_markup }
        );
      } else {
        // Если текстовое сообщение, редактируем текст
        await ctx.editMessageReplyMarkup(kb.reply_markup);
      }
      await ctx.answerCbQuery("✅ Добавлено в корзину");
    } catch {
      await ctx.answerCbQuery("✅ Добавлено в корзину");
    }
  });

  bot.action(/^cart_inc_(.+)_(\d+)_(catalog|search)$/, async (ctx) => {
    const productId = ctx.match[1];
    const page = Number(ctx.match[2]);
    const source = ctx.match[3];
    const cart = getCart(userCarts, ctx.from.id);
    const current = cart.get(productId) || 0;
    cart.set(productId, current + 1);
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const kb = getProductKeyboard(prod.id, page, cart, source);
    // Обновляем только клавиатуру
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
      await ctx.answerCbQuery();
    } catch {
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^cart_dec_(.+)_(\d+)_(catalog|search)$/, async (ctx) => {
    const productId = ctx.match[1];
    const page = Number(ctx.match[2]);
    const source = ctx.match[3];
    const cart = getCart(userCarts, ctx.from.id);
    const current = cart.get(productId) || 0;
    if (current > 1) {
      cart.set(productId, current - 1);
    } else {
      cart.delete(productId);
    }
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const kb = getProductKeyboard(prod.id, page, cart, source);
    // Обновляем только клавиатуру
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
      await ctx.answerCbQuery();
    } catch {
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^remove_from_cart_(.+)_(\d+)_(catalog|search)$/, async (ctx) => {
    const productId = ctx.match[1];
    const page = Number(ctx.match[2]);
    const source = ctx.match[3];
    const cart = getCart(userCarts, ctx.from.id);
    cart.delete(productId);
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const kb = getProductKeyboard(prod.id, page, cart, source);
    // Обновляем только клавиатуру
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
      await ctx.answerCbQuery("🗑 Удалено из корзины");
    } catch {
      await ctx.answerCbQuery("🗑 Удалено из корзины");
    }
  });

  bot.action("cart_noop", async (ctx) => {
    await ctx.answerCbQuery();
  });

  bot.action("view_cart", async (ctx) => {
    await showCart(ctx, state, userCarts);
    await ctx.answerCbQuery();
  });

  bot.action(/^edit_cart_item_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const cart = getCart(userCarts, ctx.from.id);
    const quantity = cart.get(productId) || 0;
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const text = `${prod.title}\n\n${
      prod.description || "Описание отсутствует"
    }\n\nЦена: ${prod.price || "по запросу"}\nВ корзине: ${quantity} шт.`;
    const keyboard = [
      [
        Markup.button.callback("-", `cart_edit_dec_${productId}`),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback("+", `cart_edit_inc_${productId}`),
      ],
      [
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `cart_edit_remove_${productId}`
        ),
      ],
      [Markup.button.callback("⬅️ Назад в корзину", "view_cart")],
    ];
    try {
      await ctx.editMessageText(text, {
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      });
      await ctx.answerCbQuery();
    } catch {
      await ctx.reply(text, Markup.inlineKeyboard(keyboard));
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^cart_edit_inc_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const cart = getCart(userCarts, ctx.from.id);
    const current = cart.get(productId) || 0;
    cart.set(productId, current + 1);
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const quantity = cart.get(productId);
    const text = `${prod.title}\n\n${
      prod.description || "Описание отсутствует"
    }\n\nЦена: ${prod.price || "по запросу"}\nВ корзине: ${quantity} шт.`;
    const keyboard = [
      [
        Markup.button.callback("-", `cart_edit_dec_${productId}`),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback("+", `cart_edit_inc_${productId}`),
      ],
      [
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `cart_edit_remove_${productId}`
        ),
      ],
      [Markup.button.callback("⬅️ Назад в корзину", "view_cart")],
    ];
    try {
      await ctx.editMessageText(text, {
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      });
      await ctx.answerCbQuery();
    } catch {
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^cart_edit_dec_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const cart = getCart(userCarts, ctx.from.id);
    const current = cart.get(productId) || 0;
    if (current > 1) {
      cart.set(productId, current - 1);
    } else {
      cart.delete(productId);
      await ctx.answerCbQuery("🗑 Товар удален из корзины");
      setTimeout(() => {
        ctx.answerCbQuery = async () => {};
        bot.handleUpdate({
          ...ctx.update,
          callback_query: {
            ...ctx.update.callback_query,
            data: "view_cart",
          },
        });
      }, 100);
      return;
    }
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const quantity = cart.get(productId);
    const text = `${prod.title}\n\n${
      prod.description || "Описание отсутствует"
    }\n\nЦена: ${prod.price || "по запросу"}\nВ корзине: ${quantity} шт.`;
    const keyboard = [
      [
        Markup.button.callback("-", `cart_edit_dec_${productId}`),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback("+", `cart_edit_inc_${productId}`),
      ],
      [
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `cart_edit_remove_${productId}`
        ),
      ],
      [Markup.button.callback("⬅️ Назад в корзину", "view_cart")],
    ];
    try {
      await ctx.editMessageText(text, {
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      });
      await ctx.answerCbQuery();
    } catch {
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^cart_edit_remove_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const cart = getCart(userCarts, ctx.from.id);
    cart.delete(productId);
    await ctx.answerCbQuery("🗑 Товар удален из корзины");
    if (cart.size === 0) {
      try {
        await ctx.reply("🛒 Корзина пуста", buildMainKeyboard());
      } catch {
        await ctx.reply("🛒 Корзина пуста");
      }
    } else {
      await showCart(ctx, state, userCarts);
    }
  });

  bot.action("clear_cart", async (ctx) => {
    const cart = getCart(userCarts, ctx.from.id);
    cart.clear();
    try {
      await ctx.reply("🛒 Корзина очищена", buildMainKeyboard());
      await ctx.answerCbQuery("Корзина очищена");
    } catch {
      await ctx.reply("🛒 Корзина очищена");
      await ctx.answerCbQuery("Корзина очищена");
    }
  });

  bot.action("checkout", async (ctx) => {
    const cart = getCart(userCarts, ctx.from.id);
    if (cart.size === 0) {
      await ctx.answerCbQuery("🛒 Корзина пуста", { show_alert: true });
      return;
    }
    const userName =
      `${ctx.from.first_name || ""}${
        ctx.from.last_name ? " " + ctx.from.last_name : ""
      }`.trim() || "—";
    const username = ctx.from.username ? "@" + ctx.from.username : "—";
    let total = 0;
    let orderLines = [];
    for (const [productId, quantity] of cart.entries()) {
      const prod = state.products.find(
        (p) => String(p.id) === String(productId)
      );
      const priceRaw = prod?.price || "0";
      const priceNum =
        parseFloat(
          String(priceRaw)
            .replace(/[^\d,.\-]/g, "")
            .replace(",", ".")
        ) || 0;
      const itemTotal = priceNum * quantity;
      total += itemTotal;
      orderLines.push(
        `${prod?.title || productId} — ${quantity} шт. — ${
          prod?.price || "0"
        } — ${itemTotal.toFixed(2)}`
      );
    }
    const adminText = [
      "📦 Новый заказ",
      `Пользователь: ${userName}`,
      `Username: ${username}`,
      `ID: ${ctx.from.id}`,
      "",
      "Содержимое:",
      ...orderLines,
      "",
      `Итого: ${total.toFixed(2)}`,
      `Время: ${new Date().toLocaleString()}`,
    ].join("\n");
    try {
      if (ADMIN_ID) {
        console.log(`📤 Отправка заказа администратору (ID: ${ADMIN_ID})`);
        await bot.telegram.sendMessage(ADMIN_ID, adminText);
        console.log("✅ Заказ успешно отправлен администратору");
      } else {
        console.warn("⚠️ ADMIN_ID не установлен, уведомление не отправлено");
      }
      await ctx.answerCbQuery("✅ Заказ отправлен");
      cart.clear();
      try {
        await ctx.reply(
          "✅ Заказ оформлен. Мы свяжемся с вами в ближайшее время.",
          buildMainKeyboard()
        );
      } catch {}
    } catch (e) {
      console.error("❌ Ошибка при отправке заказа администратору:", e);
      await ctx.answerCbQuery("Ошибка при оформлении заказа", {
        show_alert: true,
      });
    }
  });
}
