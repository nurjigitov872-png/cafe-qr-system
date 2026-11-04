# Backend critical npm audit: өзүнчө оңдоо планы

2026-11-05 күнү read-only `npm --prefix backend audit --json` жана `npm ls` менен текшерилди. 19 жазуу: 3 critical, 5 high, 11 moderate. Бул 3 өз алдынча exploitable катанын далили эмес: npm кыйыр dependency оордугун ата пакетке да өткөрөт. Азыр package.json/package-lock версиялары өзгөртүлгөн жок жана audit fix аткарылган жок.

| Critical жазуу | Орнотулган чынжыр | Көйгөй жана план |
|---|---|---|
| form-data | node-telegram-bot-api@0.66.0 → @cypress/request-promise@5.0.0 → request-promise-core@1.1.3 → request@2.88.2 → form-data@2.3.3; ошондой эле @cypress/request@3.0.10 → form-data@4.0.5 | Multipart boundary үчүн алсыз random; жаңы high CRLF advisory да бар. Кандидат floors: 2.5.6 жана 4.0.6 — эки advisory'ни тең эске алат. Алгач upstream Telegram dependency update же тар версиялуу overrides'ти өзүнчө текшерүү. |
| request | request-promise-core@1.1.3 → request@2.88.2 | Critical деңгээлдин бир бөлүгү form-data'дан мурасталат. Өзүнүн SSRF advisory'си moderate: cross-protocol redirects. Request колдоодон чыккан, patched version жок; form-data'ны оңдоо request чынжырын толук коопсуз кылбайт. Узак мөөнөттө эски request chain'ин алып салган транспорт/Telegram версиясы керек. |
| proxy-addr | express@4.22.1 → proxy-addr@2.0.7 | Айрым туура эмес IPv4-mapped IPv6 trust subnet конфигурацияларында X-Forwarded-For spoofing. Patched 2.0.8. Бул долбоордо server.js trust proxy иштетпейт; тесттик push limiter JWT owner'ге таянат. Бул шарт таасирди чектейт, пакетти жаңыртуунун ордун баспайт. |

Расмий advisories:
- https://github.com/advisories/GHSA-fjxv-7rqg-78g4
- https://github.com/advisories/GHSA-hmw2-7cc7-3qxx
- https://github.com/advisories/GHSA-p8p7-x288-28g6
- https://github.com/advisories/GHSA-jqcg-44mw-7w3h

## Коопсуз иш тартиби
1. Өзүнчө dependency өзгөртүү катары кароо; азыркы worktree'деги функцияларды аралаштырып жаңыртпоо. npm audit fix --force колдонбоо.
2. Биринчи proxy-addr'ды 2.0.8+ кылып уруксат берилген semver update аркылуу lockfile'да жаңыртуу. Эгер upstream constraint тоскоол болсо, өзүнчө targeted override'ды кароо. Trust proxy конфигурациясын жана JWT limiter'ди регрессия тесттерде текшерүү; npm ls/audit менен чыныгы resolved версияны ырастоо.
3. Telegram dependency chain үчүн npm registry metadata текшерүүсүндө учурдагы latest 2.3.0 кайтарылды. Аны автоматтык коопсуз upgrade деп кабыл албоо: official repository/release, package provenance, Node support жана Bot API compatibility каралсын. Ортодогу major өзгөрүүлөрдү жана кошулган/алынган көз карандылыктарды салыштыруу зарыл.
4. Кыска мөөнөттүү form-data targeted update/override эки версия бутагын тең камтысын. Request талап кылган версия диапазонун мажбурлап алмаштыруунун multipart compatibility таасирин тестирлөө. Бул request SSRF'ин өзүнчө чечпейт.
5. Эгер актуалдуу китепкана эски request'ти дагы тартып келсе, Telegram transport'ун заманбап HTTP client'ке көчүрүүнү өзүнчө тапшырма кылуу. Учурдагы sendMessage, timeout, polling=false, failure-isolation жана билдирүү форматын сактоо.
6. Backend/frontend тесттери, Telegram transport mock тесттери, push тесттери жана build өтсүн. Network, Telegram же реалдуу заказ колдонгон тест аткарылбасын. npm ci'ни обочолонгон убактылуу каталогдо гана текшерүү; учурдагы node_modules'ту уруксатсыз жок кылбоо.
7. Жаңы npm audit жыйынтыгы, өзгөргөн lockfile жана калган көйгөйлөр review үчүн көрсөтүлсүн. Уруксаттан кийин гана commit/push/deploy.

Бул пландагы версиялар advisory/registry'нин текшерилген күнүндөгү маалымат. Кийин аткарууда расмий булактан кайра ырастоо керек. HTTPS push лабораториясы production'дон бөлөк болсо да орнотулган Express колдонулат: сыртка ачууда Access allowlist жана rate limit керек; dependency оңдоосу бүткөнгө чейин аны жалпыга ачык кызмат деп кароого болбойт.
