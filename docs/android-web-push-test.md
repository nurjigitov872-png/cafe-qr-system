# Android Chrome Web Push: HTTPS тестке даярдык

Бул нускама даярдык үчүн. Азыр tunnel ачылган жок, VAPID ачкыч түзүлгөн жок, реалдуу push жөнөтүлгөн жок. Чыныгы телефон тести өзүнчө кол менен жасалат.

## Обочолонгон чөйрө
`backend/scripts/push-lab.cjs` MongoDB'ге туташпайт, Telegram импорттобойт, заказ/товар/төлөм/официант API'лерин бербейт. Катталган subscription жана rate limit RAM'да гана: процесс токтосо тазаланат. Өзүнчө логин, JWT secret жана VAPID keypair колдонот. Кадимки backend/.env жана frontend/.env окулбайт. Локалдык порт 10002, bind 127.0.0.1. Тест үчүн бир гана процесс колдонуңуз: rate limit жана 15 секунддук таймер туруктуу queue эмес.

`notification-preview.cjs` (10001/5174) ачык fake bootstrap токендерин берет. Аны tunnel аркылуу интернетке ЧЫГАРБАҢЫЗ. Телефон үчүн push-lab гана колдонулат.

## 1. Жеке тест конфигурациясын даярдоо
Node.js 22+ жана орнотулган frontend/backend көз карандылыктары керек. Долбоордун түбүнөн PowerShell'де, телефон тестине даяр болгондо гана:

```powershell
node backend/scripts/setup-push-lab.cjs
```

Бул `.env.push-lab` файлын түзөт: жаңы VAPID, өзүнчө random JWT secret жана админ сырсөзү. Скрипт маанилерди терминалга чыгарбайт, файл бар болсо үстүнөн жазбайт жана Git ignore текшерүүсүз иштебейт. Файлды VS Code'до жергиликтүү ачыңыз. Анын мазмунун чатка, screenshot'ко же Git'ке кошпоңуз.

Төмөнкүлөрдү жергиликтүү оңдоңуз:
- PUSH_LAB_ORIGIN = сизге таандык туруктуу HTTPS hostname, мисалы `https://push-test.YOUR-DOMAIN` (бул иштеп турган дарек эмес, алмаштыруучу мисал).
- VAPID_SUBJECT = өзүңүздүн `mailto:` байланыш дарегиңиз.
- PUSH_LAB_ENABLE_REAL_PUSH демейки `false`. Бул абалда чыныгы provider колдонулбайт.
- Телефон тестин аткарууга даяр болгондо гана PUSH_LAB_ENABLE_REAL_PUSH=`true` кылып, lab'ды кайра иштетиңиз. Бул startup'та push жөнөтпөйт; баскычты басуу гана жөнөтүүгө шарт түзөт.

VAPID_PRIVATE_KEY серверде гана калат. Frontend конфигурациясына VAPID public key'ди да кол менен кошуунун кереги жок: JWT менен корголгон config endpoint керектүү public key'ди берет. Git ignore текшерүү: `git check-ignore .env.push-lab`. Setup скрипти азыркы иште аткарылган жок.

## 2. Өзүнчө frontend build
Төмөнкү эки public URL сиздин PUSH_LAB_ORIGIN'ге так дал келсин. Алар сыр эмес. Чыныгы Render/Vercel URL'дерин колдонбоңуз.

```powershell
$env:VITE_APP_ENV = 'push-lab'
$env:VITE_BACKEND_ORIGIN = 'https://push-test.YOUR-DOMAIN'
$env:VITE_FRONTEND_ORIGIN = 'https://push-test.YOUR-DOMAIN'
$env:VITE_API_URL = 'https://push-test.YOUR-DOMAIN/api'
$env:VITE_SOCKET_URL = 'https://push-test.YOUR-DOMAIN'
npm --prefix frontend run build -- --outDir dist/push-lab
Remove-Item Env:VITE_APP_ENV
Remove-Item Env:VITE_BACKEND_ORIGIN
Remove-Item Env:VITE_FRONTEND_ORIGIN
Remove-Item Env:VITE_API_URL
Remove-Item Env:VITE_SOCKET_URL
node backend/scripts/push-lab.cjs
```

Бул frontend/dist/push-lab ичинде өзүнчө статикалык build түзөт; dist Git'тен четтетилген. Lab build'де hostname бар экенин сервер текшерет. Frontend эч качан телефондун `localhost` backend'ине жөнөтпөшү керек: API жана Socket.IO бир HTTPS origin аркылуу жүрөт.

## 3. Корголгон HTTPS URL
Сунуш: өзүңүздүн Cloudflare аккаунтуңуздагы named Tunnel + туруктуу `push-test.YOUR-DOMAIN` hostname + Cloudflare Access'те өз email'иңизге гана уруксат. Бул production deployment эмес; локалдык 10002 портуна убактылуу HTTPS кирүү жолу.

1. Cloudflare'дин расмий Tunnel нускамасы менен cloudflared орнотуңуз жана named tunnel түзүңүз. Credential JSON аккаунтуңуздун жеке каталогунда калсын; репозиторийге салбаңыз.
2. Public hostname катары тест subdomain'ди, service катары `http://127.0.0.1:10002` коюңуз. Бир origin frontend, API жана Socket.IO'ну тейлейт. Башка ingress'тер үчүн 404 fallback колдонуңуз.
3. Ошол hostname'ди Cloudflare Access application катары коргоп, email allowlist/OTP же аккаунтуңуздун MFA саясатын колдонуңуз. Коргоону tunnel'ди ачуудан мурда коюңуз. Тест URL'де cache'ти bypass кылыңыз: auth API жооптору no-store, sw.js no-cache болот. Access session бүткөндө API/Socket кайра кирүүнү талап кылышы мүмкүн.
4. cloudflared'ди расмий нускамадагы өз tunnel аты/жеке config файлы менен иштетиңиз. Азыр agent эч кандай tunnel орнотподу/иштетпеди. Hostname жеке аккаунтуңузга көз каранды болгондуктан даяр чыныгы URL ойлоп чыгарылган жок.
5. Телефондогу Android Chrome'до `https://push-test.YOUR-DOMAIN/admin/login` ачыңыз. Адегенде Access, андан кийин `.env.push-lab` ичиндеги өзүнчө lab логини менен кириңиз. Production сырсөзүн колдонбоңуз.
6. `https://push-test.YOUR-DOMAIN/admin/push-test` ачыңыз. Lab'да dashboard/меню маалымат API'лери жок; push-test барагы үчүн алар талап кылынбайт.

HTTP LAN IP, self-signed сертификат эскертүүсүн өткөрүү же Chrome'дун коопсуздук текшерүүлөрүн өчүрүү сунушталбайт. URL өзгөрсө, permission, service worker жана subscription башка origin'ге тиешелүү болот. Ошондуктан туруктуу hostname колдонуңуз.

Расмий: https://developers.cloudflare.com/tunnel/get-started/ ; https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/

## 4. Android'де кол менен аткарылуучу кабыл алуу тести
Төмөнкү «тесттик push» кадамы ЧЫНЫГЫ push жөнөтөт. Ал азыр аткарылган жок.

1. Chrome жана Android жаңыртылган болсун. Chrome үчүн системалык notification уруксатын, сайт үчүн Notifications уруксатын текшериңиз. Кааласаңыз PWA'ны Home Screen'ге кошуңуз; Chrome web push текшерүүсү үчүн орнотуу милдеттүү эмес.
2. 🔔 ачыңыз → «Телефонго билдирүү алуу» басыңыз. Уруксат ушул баскычта гана суралат, барак жүктөлгөндө суралбайт.
3. «Push диагностикасы»: secureContext=true, permission=granted, serviceWorker=activated, controlled=true, subscription=true, configured=true күтүлөт. Service worker жаңы орнотулса баракты бир жолу жаңыртыңыз.
4. Өзүнчө чыныгы push текшерүүсүнө даяр болгондо «Тесттик push жөнөтүү · 15 сек» басыңыз. Андан кийин Chrome'ду фонго өткөрүңүз. 15 секунддан соң generic тест билдирүүсүн күтүңүз. Бул заказ түзбөйт.
5. Кийинки тестке кеминде 60 секунд күтүп, ошол кадамды экран кулпуланган абалда кайталаңыз. Компьютердеги lab жана tunnel иштеп турушу керек; экранды кулпулоо Chrome'ду Force stop кылууга барабар эмес.
6. Тесттен кийин баракка кайтып diagnostics'ти жаңыртыңыз: lastTest=accepted provider кабыл алганын гана билдирет; worker.lastPush.state=shown браузер showNotification ийгиликтүү бүткөнүн билдирет. Телефондогу чыныгы көрүнүштү өзүңүз ырастайсыз. Notification'ду басуу ошол тест origin'ине гана өтөт.
7. Android батарея үнөмдөө, DND, Chrome/PWA системалык notification channel жана lock-screen privacy жөндөөлөрү көрсөтүүнү/үндү чектеши мүмкүн. WebAudio коңгуроосу сайт ачык турганда иштейт; фон/кулпуланган экрандагы үндү Android башкарат. Push жетүүсү же үнү кепилденбейт.

## Диагностика жана каталар
- `subscriptionMissing`: ушул түзмөктө/учурдагы JWT үчүн subscription жок.
- `subscriptionExpired`: provider 404/410 кайтарды; эски subscription тазаланат. Push'ту өчүрүп кайра жандырыңыз.
- `vapidRejected`: provider 401/403; keypair/subject жана subscription түзүлгөн public key дал келерин жеке текшериңиз. Keypair алмашса эски subscription'ду кайра түзүңүз.
- `pushTestRateLimited`: 429 + Retry-After; колдонуучуга 60 сек чеги. Жалпы 60/саат чеги жана map capacity бар, IP header'ге таянбайт.
- `providerRateLimited` же `pushDeliveryFailed`: provider/network көйгөйү; raw response, endpoint жана ачкычтар интерфейске/логго берилбейт.
- SW `received`, `shown`, `duplicate`, `notification-failed`, `invalid-payload` абалдары гана убактысы менен сакталат. Payload, JWT, endpoint жана шифр ачкычтары diagnostics'ке сакталбайт.
- `pushScheduled` кийин процесс токтосо таймер жок болот. Бул тесттик механизм, durable queue эмес. Таймер иштегенде JWT мөөнөтү жана ушул owner'дин subscription'у кайра текшерилет.
- Chrome USB remote debugging: desktop `chrome://inspect/#devices`, Application → Service Workers жана Background services → Push messaging / Notifications. Network/консоль логдорунда Authorization же subscription body'лерин көчүрүп бөлүшпөңүз.

Расмий: https://developer.chrome.com/docs/devtools/javascript/background-services ; https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DAndroid&hl=en

## Коопсуздукту текшерүү жана токтотуу
`POST /api/notifications/test-push` JWT талап кылат; owner/role/recipient/message/payload body талаалары четке кагылат. Бир гана endpoint тандалат жана ал серверде ошол JWT owner'ине катталган болушу керек. Admin да башка колдонуучунун subscription'уна бул маршрут аркылуу жөнөтө албайт. Test endpoint демейки өчүк; PUSH_TEST_ENABLED=true жана NODE_ENV!=production болгондо гана ачылат. Diagnostics да ушул gate жана JWT менен корголот.

Сыноо бүткөндө push'ту өчүрүп/logout кылыңыз, lab/tunnel процесстерин токтотуңуз, PUSH_LAB_ENABLE_REAL_PUSH=false кылыңыз. RAM subscription'дар process менен тазаланат, телефондогу сайт permission'ин жана SW'ни Chrome жөндөөсүнөн тазаласаңыз болот. .env.push-lab жана tunnel credentials Git'ке кошулбайт. Git commit/push/deploy өзүнчө уруксат талап кылат.
