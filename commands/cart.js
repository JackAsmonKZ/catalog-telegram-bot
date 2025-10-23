import { Markup } from "telegraf";
import { getCart, parseCartKey, getPriceByVolume } from "./utils.js";
import { getProductKeyboard, buildMainKeyboard } from "./keyboards.js";
import { showCart } from "./catalogHandlers.js";

export function registerCartHandlers(bot, state, userCarts, ADMIN_ID) {
  bot.action(
    /^add_to_cart_(.+)_(.+)_(\d+)_(catalog|search)_(.+)$/,
    async (ctx) => {
      const productId = ctx.match[1];
      const volume = ctx.match[2];
      const page = Number(ctx.match[3]);
      const source = ctx.match[4];
      const categoryId = ctx.match[5] === "none" ? null : ctx.match[5];
      const cart = getCart(userCarts, ctx.from.id);
      const cartKey = `${productId}_${volume}`;
      cart.set(cartKey, 1);
      const prod = state.products.find(
        (p) => String(p.id) === String(productId)
      );
      if (!prod) {
        await ctx.answerCbQuery("Товар не найден", { show_alert: true });
        return;
      }
      const kb = getProductKeyboard(
        prod.id,
        page,
        cart,
        source,
        categoryId,
        volume
      );
      // Обновляем только клавиатуру
      try {
        await ctx.editMessageReplyMarkup(kb.reply_markup);
        await ctx.answerCbQuery("✅ Добавлено в корзину");
      } catch {
        await ctx.answerCbQuery("✅ Добавлено в корзину");
      }
    }
  );

  bot.action(
    /^cart_inc_(.+)_(.+)_(\d+)_(catalog|search)_(.+)$/,
    async (ctx) => {
      const productId = ctx.match[1];
      const volume = ctx.match[2];
      const page = Number(ctx.match[3]);
      const source = ctx.match[4];
      const categoryId = ctx.match[5] === "none" ? null : ctx.match[5];
      const cart = getCart(userCarts, ctx.from.id);
      const cartKey = `${productId}_${volume}`;
      const current = cart.get(cartKey) || 0;
      cart.set(cartKey, current + 1);
      const prod = state.products.find(
        (p) => String(p.id) === String(productId)
      );
      if (!prod) {
        await ctx.answerCbQuery("Товар не найден", { show_alert: true });
        return;
      }
      const kb = getProductKeyboard(
        prod.id,
        page,
        cart,
        source,
        categoryId,
        volume
      );
      try {
        await ctx.editMessageReplyMarkup(kb.reply_markup);
        await ctx.answerCbQuery();
      } catch {
        await ctx.answerCbQuery();
      }
    }
  );

  bot.action(
    /^cart_dec_(.+)_(.+)_(\d+)_(catalog|search)_(.+)$/,
    async (ctx) => {
      const productId = ctx.match[1];
      const volume = ctx.match[2];
      const page = Number(ctx.match[3]);
      const source = ctx.match[4];
      const categoryId = ctx.match[5] === "none" ? null : ctx.match[5];
      const cart = getCart(userCarts, ctx.from.id);
      const cartKey = `${productId}_${volume}`;
      const current = cart.get(cartKey) || 0;
      if (current > 1) {
        cart.set(cartKey, current - 1);
      } else {
        cart.delete(cartKey);
      }
      const prod = state.products.find(
        (p) => String(p.id) === String(productId)
      );
      if (!prod) {
        await ctx.answerCbQuery("Товар не найден", { show_alert: true });
        return;
      }
      const kb = getProductKeyboard(
        prod.id,
        page,
        cart,
        source,
        categoryId,
        volume
      );
      try {
        await ctx.editMessageReplyMarkup(kb.reply_markup);
        await ctx.answerCbQuery();
      } catch {
        await ctx.answerCbQuery();
      }
    }
  );

  bot.action(
    /^remove_from_cart_(.+)_(.+)_(\d+)_(catalog|search)_(.+)$/,
    async (ctx) => {
      const productId = ctx.match[1];
      const volume = ctx.match[2];
      const page = Number(ctx.match[3]);
      const source = ctx.match[4];
      const categoryId = ctx.match[5] === "none" ? null : ctx.match[5];
      const cart = getCart(userCarts, ctx.from.id);
      const cartKey = `${productId}_${volume}`;
      cart.delete(cartKey);
      const prod = state.products.find(
        (p) => String(p.id) === String(productId)
      );
      if (!prod) {
        await ctx.answerCbQuery("Товар не найден", { show_alert: true });
        return;
      }
      const kb = getProductKeyboard(
        prod.id,
        page,
        cart,
        source,
        categoryId,
        volume
      );
      try {
        await ctx.editMessageReplyMarkup(kb.reply_markup);
        await ctx.answerCbQuery("🗑 Удалено из корзины");
      } catch {
        await ctx.answerCbQuery("🗑 Удалено из корзины");
      }
    }
  );

  bot.action("cart_noop", async (ctx) => {
    await ctx.answerCbQuery();
  });

  bot.action("view_cart", async (ctx) => {
    await showCart(ctx, state, userCarts);
    await ctx.answerCbQuery();
  });

  bot.action(/^edit_cart_item_(.+)$/, async (ctx) => {
    const cartKey = ctx.match[1];
    const { productId, volume } = parseCartKey(cartKey);
    const cart = getCart(userCarts, ctx.from.id);
    const quantity = cart.get(cartKey) || 0;
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }

    // Получаем цену для конкретного объема
    const priceObj = getPriceByVolume(prod, volume);
    const priceText = priceObj ? priceObj.price : prod.price || "по запросу";

    const text = `${prod.title}\n\n${
      prod.description || "Описание отсутствует"
    }\n\nОбъем: ${volume}\nЦена: ${priceText}\nВ корзине: ${quantity} шт.`;
    const keyboard = [
      [
        Markup.button.callback("-", `cart_edit_dec_${cartKey}`),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback("+", `cart_edit_inc_${cartKey}`),
      ],
      [
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `cart_edit_remove_${cartKey}`
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
    const cartKey = ctx.match[1];
    const { productId, volume } = parseCartKey(cartKey);
    const cart = getCart(userCarts, ctx.from.id);
    const current = cart.get(cartKey) || 0;
    cart.set(cartKey, current + 1);
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (!prod) {
      await ctx.answerCbQuery("Товар не найден", { show_alert: true });
      return;
    }
    const quantity = cart.get(cartKey);

    // Получаем цену для конкретного объема
    const priceObj = getPriceByVolume(prod, volume);
    const priceText = priceObj ? priceObj.price : prod.price || "по запросу";

    const text = `${prod.title}\n\n${
      prod.description || "Описание отсутствует"
    }\n\nОбъем: ${volume}\nЦена: ${priceText}\nВ корзине: ${quantity} шт.`;
    const keyboard = [
      [
        Markup.button.callback("-", `cart_edit_dec_${cartKey}`),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback("+", `cart_edit_inc_${cartKey}`),
      ],
      [
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `cart_edit_remove_${cartKey}`
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
    const cartKey = ctx.match[1];
    const { productId, volume } = parseCartKey(cartKey);
    const cart = getCart(userCarts, ctx.from.id);
    const current = cart.get(cartKey) || 0;
    if (current > 1) {
      cart.set(cartKey, current - 1);
    } else {
      cart.delete(cartKey);
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
    const quantity = cart.get(cartKey);

    // Получаем цену для конкретного объема
    const priceObj = getPriceByVolume(prod, volume);
    const priceText = priceObj ? priceObj.price : prod.price || "по запросу";

    const text = `${prod.title}\n\n${
      prod.description || "Описание отсутствует"
    }\n\nОбъем: ${volume}\nЦена: ${priceText}\nВ корзине: ${quantity} шт.`;
    const keyboard = [
      [
        Markup.button.callback("-", `cart_edit_dec_${cartKey}`),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback("+", `cart_edit_inc_${cartKey}`),
      ],
      [
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `cart_edit_remove_${cartKey}`
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
    const cartKey = ctx.match[1];
    const cart = getCart(userCarts, ctx.from.id);
    cart.delete(cartKey);
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

    let total = 0;
    let orderLines = [];
    let itemNumber = 1;

    for (const [cartKey, quantity] of cart.entries()) {
      // Парсим ключ корзины: productId_volume
      const { productId, volume } = parseCartKey(cartKey);
      const prod = state.products.find(
        (p) => String(p.id) === String(productId)
      );

      if (!prod) continue;

      // Получаем цену для конкретного объема
      const priceObj = getPriceByVolume(prod, volume);
      let priceRaw = "0";

      if (priceObj) {
        priceRaw = priceObj.price;
      } else if (prod.price) {
        priceRaw = prod.price;
      }

      const priceNum =
        parseFloat(
          String(priceRaw)
            .replace(/[^\d,.\-]/g, "")
            .replace(",", ".")
        ) || 0;
      const itemTotal = priceNum * quantity;
      total += itemTotal;

      // Формат для WhatsApp (если количество > 1, показываем его)
      if (quantity > 1) {
        orderLines.push(
          `${itemNumber}.⁠ ⁠${prod.title} — ${volume} — ${priceRaw} × ${quantity} шт.\n`
        );
      } else {
        orderLines.push(
          `${itemNumber}.⁠ ⁠${prod.title} — ${volume} — ${priceRaw}\n`
        );
      }
      itemNumber++;
    }

    // Формируем текст для WhatsApp
    const whatsappText = [
      "Привет!",
      "Хотела бы проконсультироваться и оформить заказ Rooicell.",
      "",
      "Корзина:",
      ...orderLines,
      "",
      `Итого: ${total.toFixed(0)} ₸`,
    ].join("\n");
    //Сюда вставить свой номер телефона
    const telNumber = "123123";
    const whatsappUrl = `https://wa.me/${telNumber}?text=${encodeURIComponent(
      whatsappText
    )}`;

    // Очищаем корзину
    cart.clear();

    // Отправляем сообщение с кнопкой WhatsApp
    const message = `✅ Ваш заказ готов!\n\nИтого: ${total.toFixed(
      0
    )} ₸\n\n👇 Нажмите кнопку ниже для оформления:`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url("💬 Открыть WhatsApp", whatsappUrl)],
    ]);

    try {
      await ctx.reply(message, keyboard);
      await ctx.answerCbQuery();
    } catch (e) {
      console.error("Ошибка при отправке ссылки WhatsApp:", e);
      await ctx.answerCbQuery("Ошибка при оформлении заказа", {
        show_alert: true,
      });
    }
  });
}
