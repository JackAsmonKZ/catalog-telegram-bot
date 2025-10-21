import fs from "fs-extra";

export function getCart(userCarts, userId) {
  if (!userCarts.has(userId)) {
    userCarts.set(userId, new Map());
  }
  return userCarts.get(userId);
}

export function isAdmin(ADMIN_ID, ctx) {
  return ADMIN_ID && String(ctx.from?.id) === String(ADMIN_ID);
}

export async function saveProducts(dbPath, products) {
  await fs.writeJson(dbPath, products, { spaces: 2 });
}

// Функция для генерации нового ID
export function generateNewProductId(products) {
  if (products.length === 0) {
    return "1";
  }
  // Находим максимальный числовой ID
  const maxId = Math.max(
    ...products.map((p) => {
      const numId = parseInt(String(p.id));
      return isNaN(numId) ? 0 : numId;
    })
  );
  return String(maxId + 1);
}

// Функция для отправки товара с фото
export async function sendProductWithPhoto(
  ctx,
  prod,
  keyboard,
  isEdit = false
) {
  const caption = `${prod.title}\n\n${
    prod.description || "Описание отсутствует"
  }\n\nЦена: ${prod.price || "по запросу"}`;

  if (prod.photo) {
    try {
      if (isEdit) {
        // При редактировании удаляем старое сообщение и отправляем новое с фото
        try {
          await ctx.deleteMessage();
        } catch {
          // Если не удалось удалить, просто отправляем новое
        }
        await ctx.replyWithPhoto(prod.photo, {
          caption: caption,
          reply_markup: keyboard.reply_markup,
        });
      } else {
        // Обычная отправка с фото
        await ctx.replyWithPhoto(prod.photo, {
          caption: caption,
          reply_markup: keyboard.reply_markup,
        });
      }
    } catch (error) {
      // Если не удалось загрузить фото, отправляем текстом
      const text = `${caption}\n\n⚠️ Не удалось загрузить фото`;
      if (isEdit) {
        try {
          await ctx.editMessageText(text, {
            reply_markup: keyboard.reply_markup,
          });
        } catch {
          await ctx.reply(text, keyboard);
        }
      } else {
        await ctx.reply(text, keyboard);
      }
    }
  } else {
    // Если фото нет, редактируем текстовое сообщение
    if (isEdit) {
      try {
        await ctx.editMessageText(caption, {
          reply_markup: keyboard.reply_markup,
        });
      } catch {
        await ctx.reply(caption, keyboard);
      }
    } else {
      await ctx.reply(caption, keyboard);
    }
  }
}
