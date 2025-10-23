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

// Функция для генерации нового ID категории
export function generateNewCategoryId(categories) {
  if (categories.length === 0) {
    return "1";
  }
  const maxId = Math.max(
    ...categories.map((c) => {
      const numId = parseInt(String(c.id));
      return isNaN(numId) ? 0 : numId;
    })
  );
  return String(maxId + 1);
}

// Функция для сохранения категорий
export async function saveCategories(categoriesPath, categories) {
  await fs.writeJson(categoriesPath, categories, { spaces: 2 });
}

// Функция для удаления категории и обновления товаров
export async function deleteCategoryAndUpdateProducts(
  categories,
  products,
  categoryId,
  categoriesPath,
  productsPath
) {
  // Удаляем категорию
  const categoryIndex = categories.findIndex(
    (c) => String(c.id) === String(categoryId)
  );
  if (categoryIndex === -1) {
    return { success: false, message: "Категория не найдена" };
  }

  const categoryName = categories[categoryIndex].name;
  categories.splice(categoryIndex, 1);

  // Удаляем categoryId у всех товаров этой категории
  let updatedCount = 0;
  products.forEach((product) => {
    if (String(product.category) === String(categoryId)) {
      delete product.category;
      updatedCount++;
    }
  });

  // Сохраняем изменения
  await saveCategories(categoriesPath, categories);
  await fs.writeJson(productsPath, products, { spaces: 2 });

  return {
    success: true,
    message: `Категория "${categoryName}" удалена. ${updatedCount} товар(ов) перемещены в "Без категории".`,
  };
}

// Функция для получения категории по ID
export function getCategoryById(categories, categoryId) {
  return categories.find((c) => String(c.id) === String(categoryId));
}

// Функция для получения цены по объему
export function getPriceByVolume(product, volume) {
  if (!product.prices || !Array.isArray(product.prices)) {
    return null;
  }
  return product.prices.find((p) => p.volume === volume);
}

// Функция для форматирования ключа корзины (productId + volume)
export function getCartKey(productId, volume) {
  return `${productId}_${volume}`;
}

// Функция для парсинга ключа корзины
export function parseCartKey(cartKey) {
  const parts = cartKey.split("_");
  const volume = parts.pop(); // Последняя часть - volume
  const productId = parts.join("_"); // Остальное - productId
  return { productId, volume };
}

// Функция для получения товаров по категории
export function getProductsByCategory(products, categories, categoryId) {
  // Специальная категория "Без категории"
  if (categoryId === "uncategorized") {
    return products.filter((p) => {
      if (!p.category) return true;
      // Проверяем, существует ли категория товара
      return !categories.find((c) => String(c.id) === String(p.category));
    });
  }
  return products.filter((p) => String(p.category) === String(categoryId));
}

// Функция для отправки товара с фото
export async function sendProductWithPhoto(
  ctx,
  prod,
  keyboard,
  isEdit = false,
  selectedVolume = null
) {
  // Формируем описание цен
  let priceText = "";
  if (selectedVolume && prod.prices) {
    // Если объем выбран, показываем только его цену
    const priceObj = prod.prices.find((p) => p.volume === selectedVolume);
    if (priceObj) {
      priceText = `\n\nОбъем: ${priceObj.volume}\nЦена: ${priceObj.price}`;
    }
  } else if (
    prod.prices &&
    Array.isArray(prod.prices) &&
    prod.prices.length > 0
  ) {
    // Если объем не выбран, показываем все варианты
    priceText = "\n\nВыберите объем:";
    prod.prices.forEach((p) => {
      priceText += `\n• ${p.volume} — ${p.price}`;
    });
  } else if (prod.price) {
    // Поддержка старого формата
    priceText = `\n\nЦена: ${prod.price}`;
  }

  const caption = `${prod.title}\n\n${
    prod.description || "Описание отсутствует"
  }${priceText}`;

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
