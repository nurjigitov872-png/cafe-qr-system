# Real-time notification / PWA

## Коопсуз локалдык көрүү
`node backend/scripts/notification-preview.cjs`

- Башкаруу: http://localhost:10001/
- Кардар: http://localhost:5174/notification-preview?view=customer
- Ашкана: http://localhost:5174/notification-preview?view=kitchen
- Официант: http://localhost:5174/notification-preview?view=waiter

Үч баракты ачып, 10001 портундагы «Жаңы заказ», «Официант чакыруу», «Даяр», «Берилди» баскычтарын басыңыз. Бул өзүнчө in-memory backend. `.env` окулбайт, MongoDB туташуусу жок, Telegram жана web-push transport иштетилбейт. Реалдуу заказ түзүү/официант POST endpoint'тери бул demo'до өчүрүлгөн. Меню 15 позициянын сакталган snapshot'ун гана окуйт. Demo тарыхы процесс токтогондо тазаланат. 5174 портунун localStorage'ы кадимки 5173төн бөлөк. Demo fake JWT'лери ушул процессте гана жарактуу. Demo серверди production'го чыгарбаңыз; localhost менен гана байланышат.

Кадимки колдонмо `npm --prefix frontend run dev` менен иштейт; анын API жөндөөсүнө жараша реалдуу backend колдонулушу мүмкүн. Коопсуз notification текшерүүсү үчүн жогорудагы 5174 demo'ну колдонуңуз.

## Коопсуздук жана окуялар
- Socket.IO handshake, inbox, read жана subscription endpoint'тери HS256 JWT'ни issuer/audience/exp менен текшерет.
- Кардар `customer:<orderId>` JWT аркылуу `order:<orderId>` бөлмөсүнө гана кирет. Клиент бөлмөнү же ролду өзү тандай албайт. Өзгөлөрдүн заказын окуу/белгилөө мүмкүн эмес.
- Учурдагы панелдер админ логинин колдонот. Notification катмары signed `kitchen` жана `waiter` ролдорун да өз бөлмөлөрүнө чектейт, бирок жаңы кызматкер аккаунттары/логин системасы кошулган жок. Мурунку админ API укуктары кеңейтилген жок.
- Заказдын толук legacy Socket.IO payload'дары staff бөлмөлөрүнө гана жөнөтүлөт; кардарга статус метадайындары гана берилет.
- Жаңы заказ → admin/kitchen/waiter; официант чакыруу → admin/waiter; статус өзгөрүүсү → staff жана тиешелүү кардар. served кардар барагын жаңыртат.
- Тарых, окуу белгилери жана push subscription өзүнчө MongoDB коллекцияларында сакталат; заказ/товар документтери өчүрүлбөйт. Окуя/окуу тарыхы 7 күн, subscription JWT бүткөнгө чейин сакталат. TTL тазалоосу кечиксе да суроолор мөөнөтүн текшерет.
- Окуянын unique key'и, статус өзгөрүүсүнүн атомдук текшерүүсү, frontend merge жана service worker IndexedDB кайра жөнөтүлгөн окуяларды кайталатпайт.
- Тарыхтын акыркы 100 окуясы reconnect/refresh учурунда алынат. Socket өчсө inbox жана кардар статусу 30 секунд сайын текшерилет. Эски окуялар жаңы toast/үн чыгарбайт.
- Үн AudioContext аркылуу өзүнчө баскыч менен күйөт. Push уруксаты «Телефонго билдирүү алуу» баскычынан гана суралат. Колдобогон/уруксат берилбеген браузерде сайт ичиндеги билдирүүлөр калат.
- Push payload'унда товар, комментарий, төлөм же JWT жок. Provider endpoint'тери HTTPS allowlist менен текшерилет; токендер же endpoint'тер логго чыгарылбайт. 404/410 subscription'дар тазаланат. Logout браузердеги subscription'ду токтотот.
- Service worker API'ни, заказ барактарын же токендерди кэшке сактабайт; интернетсиз жөнөкөй offline барак көрсөтөт. Click URL ошол origin'деги уруксат берилген маршрут менен чектелет.

## Production даярдоо (азыр жасалган жок)
1. Бардык тесттерди жана frontend build'ди иштетиңиз. Өзгөрүүлөрдү карап, өзүнчө deployment уруксатын алыңыз.
2. Backend жана frontend HTTPS колдонсун. CLIENT_URL/CORS_ORIGIN frontend origin'ге, VITE_API_URL жана VITE_SOCKET_URL backend'ге туура келсин. Frontend hosting SPA rewrite кылып, `/sw.js`, `/manifest.webmanifest`, `/icons/*`, `/offline.html` файлдарын түз бериши керек. `/sw.js` үчүн Cache-Control: no-cache сунушталат.
3. Жергиликтүү ишенимдүү терминалда `backend` папкасынан `npx web-push generate-vapid-keys` иштетиңиз. Натыйжаны чатка/Git'ке чыгарбаңыз. Backend secret settings'ке VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (`mailto:` байланыш дареги) кошуңуз. Private key frontend'ге берилбейт. Бул иштин жүрүшүндө эч кандай чыныгы ачкыч түзүлгөн же өзгөртүлгөн жок.
4. VAPID жок/жараксыз болсо backend иштей берет, in-app notifications калат, push config enabled:false болот. `/api/notifications/config` ачык эмес; JWT талап кылат.
5. Backend'дин жаңы версиясын frontend менен шайкеш чыгарыңыз: кардар Socket.IO кошулардан мурда серверде room isolation болушу керек. Мурунку жалпы broadcast версиясына customer socket'терди туташтырбаңыз.
6. Уруксат берилген түзмөктө PWA орнотуп, андан кийин баскыч менен push'ту жандырыңыз. iOS түзмөктөрүндө Home Screen'ге кошулган web app жана колдоого алынган OS талап кылынат. OS/browser чектөөлөрүнөн улам push жетүүсү кепилденбейт.
7. Реалдуу push/order/Telegram end-to-end текшерүүсүн өзүнчө уруксат менен гана аткарыңыз. Азыркы тесттер жасалма transport/API менен гана өткөрүлдү.

## Практикалык чектер
Бир backend instance үчүн Socket.IO даяр. Бир нече instance болгондо room/event бөлүшүү үчүн Redis adapter сыяктуу орток transport керек. Push жөнөтүү азыр сакталган окуядан кийин жасалат: provider/network ката берсе логдо сырсыз белги калат, inbox окуясы сакталат; туруктуу retry queue кошулган жок. MongoDB иштебей калса notification катмары заказдын сакталганын катага айлантпайт, бирок ал учурдун notification тарыхын калыбына келтирүүгө durable outbox керек. Бул WhatsApp деңгээлиндеги жеткирүү кепилдиги эмес.


API/Socket ????? ???????: [connection-safety.md](connection-safety.md). VITE_APP_ENV ?????????; production fallback ???. Local backend ??????????????? ?????? ????????? ??????????.
