const labels = {
  title: ["Стол брондоо", "Бронирование столика", "Reserve a table", "Masa rezervasyonu"],
  day: ["Күнү", "Дата", "Date", "Tarih"],
  time: ["Убактысы", "Время", "Time", "Saat"],
  guests: ["Коноктор", "Гости", "Guests", "Misafirler"],
  choose: ["Убакытты тандаңыз", "Выберите время", "Choose a time", "Saat seçin"],
  noTimes: ["Бош убакыт жок", "Нет доступного времени", "No times available", "Uygun saat yok"],
  tables: ["Столдор", "Столики", "Tables", "Masalar"],
  seats: ["Орун", "Мест", "Seats", "Kapasite"],
  name: ["Аты-жөнү", "Имя", "Name", "Ad soyad"],
  phone: ["Телефон", "Телефон", "Phone", "Telefon"],
  submit: ["Брондоо өтүнүчүн жөнөтүү", "Отправить заявку", "Request reservation", "Rezervasyon isteği gönder"],
  pending: ["Ырастоо күтүлүүдө", "Ожидает подтверждения", "Awaiting confirmation", "Onay bekliyor"],
  confirmed: ["Ырасталды", "Подтверждено", "Confirmed", "Onaylandı"],
  cancelled: ["Жокко чыгарылды", "Отменено", "Cancelled", "İptal edildi"],
  expired: ["Күтүү мөөнөтү бүттү", "Время ожидания истекло", "Confirmation window expired", "Onay süresi doldu"],
  confirm: ["Ырастоо", "Подтвердить", "Confirm", "Onayla"],
  cancel: ["Жокко чыгаруу", "Отменить", "Cancel", "İptal et"],
  expires: ["Ырастоо мөөнөтү", "Подтвердить до", "Confirm by", "Onay son saati"],
  conflict: ["Убакыт же стол жеткиликсиз. Кайра тандаңыз.", "Время или стол недоступны. Выберите снова.", "That time or table is unavailable. Choose again.", "Bu masa veya saat uygun değil. Yeniden seçin."],
  invalid: ["Киргизилген маалыматтарды текшериңиз.", "Проверьте введённые данные.", "Check the information you entered.", "Girdiğiniz bilgileri kontrol edin."],
  error: ["Брондоо маалыматын алуу мүмкүн болгон жок.", "Не удалось загрузить данные бронирования.", "Could not load reservation data.", "Rezervasyon bilgileri yüklenemedi."],
  loading: ["Жүктөлүүдө…", "Загрузка…", "Loading…", "Yükleniyor…"],
  empty: ["Бул күнгө брон жок", "На эту дату нет броней", "No reservations for this date", "Bu tarihte rezervasyon yok"],
  calendar: ["Брондоо календары", "Календарь бронирований", "Reservation calendar", "Rezervasyon takvimi"],
  layout: ["Столдордун схемасы", "Схема столиков", "Table layout", "Masa planı"],
  refresh: ["Жаңыртуу", "Обновить", "Refresh", "Yenile"],
};

export function reservationLabel(language, key) {
  const index = ["ky", "ru", "en", "tr"].indexOf(language);
  return labels[key]?.[Math.max(index, 0)] ?? key;
}
