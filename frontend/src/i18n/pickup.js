const labels = {
  title: ["Алдын ала алып кетүү", "Заказ навынос", "Order for pickup", "Gel al siparişi"],
  lead: ["Азыр заказ берип, тандаган убакта алып кетиңиз.", "Закажите заранее и заберите в выбранное время.", "Order now and collect at your chosen time.", "Şimdi sipariş verin, seçtiğiniz saatte alın."],
  day: ["Алып кетүү күнү", "Дата получения", "Pickup date", "Teslim alma tarihi"],
  time: ["Алып кетүү убактысы", "Время получения", "Pickup time", "Teslim alma saati"],
  pay: ["Алып кеткенде төлөө", "Оплата при получении", "Pay at pickup", "Teslim alırken öde"],
  code: ["Алып кетүү коду", "Код получения", "Pickup code", "Teslim alma kodu"],
  collect: ["Код менен тапшыруу", "Выдать по коду", "Collect with code", "Kodla teslim et"],
  checkoutError: ["Заказ ырасталган жок. Ошол эле маалымат менен кайра аракет кылыңыз.", "Заказ не подтверждён. Повторите с теми же данными.", "The order was not confirmed. Retry with the same details.", "Sipariş onaylanmadı. Aynı bilgilerle tekrar deneyin."],
  conflict: ["Бул сурам мурда башка маалымат менен кабыл алынган. Мурунку маалымат менен кайра аракет кылыңыз.", "Этот запрос уже принят с другими данными. Повторите с исходными данными.", "This request was already accepted with different details. Retry with the original details.", "Bu istek farklı bilgilerle kabul edildi. İlk bilgilerle tekrar deneyin."],
  retry: ["Кайра жүктөө", "Обновить", "Reload", "Yenile"],
  codeLocked: ["Өтө көп туура эмес аракет. 15 мүнөттөн кийин кайталаңыз.", "Слишком много неверных попыток. Повторите через 15 минут.", "Too many incorrect attempts. Try again in 15 minutes.", "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin."],
  contact: ["Байланыш маалыматы", "Контактные данные", "Contact details", "İletişim bilgileri"],
};
export function pickupLabel(language, key) {
  return labels[key]?.[Math.max(["ky", "ru", "en", "tr"].indexOf(language), 0)] ?? key;
}
