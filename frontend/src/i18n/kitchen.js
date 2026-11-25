const labels = {
  asap: ["Мүмкүн болушунча тез", "Как можно скорее", "As soon as possible", "Mümkün olan en kısa sürede"],
  estimate: ["Болжолдуу даяр болуу убактысы", "Ориентировочное время готовности", "Estimated ready time", "Tahmini hazır olma zamanı"],
  note: ["Бул болжол. Убакыт өзгөрүшү мүмкүн.", "Это оценка. Время может измениться.", "This is an estimate. The time may change.", "Bu bir tahmindir. Süre değişebilir."],
  delayed: ["Заказ дагы даярдала элек. Болжол жаңыртылышы мүмкүн.", "Заказ ещё не готов. Оценка может обновиться.", "The order is still being prepared. The estimate may be updated.", "Sipariş henüz hazır değil. Tahmin güncellenebilir."],
  select: ["Даярдоо убактысын тандаңыз", "Выберите время приготовления", "Select preparation time", "Hazırlık süresini seçin"],
  custom: ["Башка убакыт", "Другое время", "Custom duration", "Özel süre"],
  minutes: ["Мүнөт", "Минуты", "Minutes", "Dakika"],
  save: ["Болжолду сактоо", "Сохранить оценку", "Save estimate", "Tahmini kaydet"],
  error: ["Болжолду сактоо мүмкүн болгон жок.", "Не удалось сохранить оценку.", "Could not save the estimate.", "Tahmin kaydedilemedi."],
  closed: ["Ресторан жабык. Иштөө убагында кайра аракет кылыңыз.", "Ресторан закрыт. Повторите в рабочее время.", "The restaurant is closed. Try again during opening hours.", "Restoran kapalı. Çalışma saatlerinde tekrar deneyin."],
};

export function kitchenLabel(language, key) {
  return labels[key]?.[Math.max(["ky", "ru", "en", "tr"].indexOf(language), 0)] ?? key;
}
