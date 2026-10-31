# Pacchetto Play 1.76 - 31 ottobre 2026

Questo è il pacchetto da caricare su Play Console. Sostituisce gli AAB 1.70 e 1.72, che descrivono client precedenti. La verifica è stata fatta sul PC. Il pacchetto non è stato installato da Play e non è stato caricato in Console.

- Origine: release `apk-76`, workflow «App Android (APK)» sul commit `ce847a1` (Prove, Pages e build superati).
- File: [Smazzata.aab](https://github.com/Smazzata/smazzata.github.io/releases/download/apk-76/Smazzata.aab), 23.024.764 byte.
- SHA-256: `c2d7ac089db15fd86860e28f5243032d5c10184b5b57a62b77a9c210fce20bbd`.
- Package `it.smazzata.app`, versione `1.76`/76. Android minimo API 24, target e compile API 36. Modalità `SmazzataStore` presente.
- Firma interna valida, con 690 file a digest verificato.
- Certificato upload SHA-256 `7866C935A935DED7000E4E2BFB327F860C27278671DB25DB0C9C726F98D7F6FE`, uguale alla 1.72 e distinto dalla chiave dell'APK pubblico. La corrispondenza con la Console si confronta al primo caricamento.
- Permessi: Internet, vibrazione e permesso interno non esportato. Nessun microfono, rubrica o posizione.
- Client `2026.10.31.2`, cache v98 sia nell'ingresso sia in `gioca/`. 248 file di public/shared/launcher sono uguali ai sorgenti. La data della privacy letta è 26 ottobre 2026.
- `node server/release-ui-test.js --package …`: 34 scene superate sui file estratti dall'AAB, motore offline compreso.

Evidenze in `VERIFICA-AAB-1.76.json`.

## Schermate store

Le schermate sono state rigenerate con `node server/release-ui-test.js --store`. Sono cambiate le 03, 04, 05 e 08, perché smazzate e nomi sono casuali. Il resto è invariato.

Due limiti visibili sono da valutare prima di caricarle:
- sotto i giocatori computer compare «CPU · 11 …», con il numero di carte tagliato;
- nella 05 (Scala 40 a quattro) l'intestazione «I tuoi giochi» finisce sotto i comandi in basso. Era già così nella versione del 29 ottobre.

## Non verificato

Non sono stati verificati: installazione da Play, Play App Signing, pre-launch report, telefoni fisici con il pacchetto Play, server e rete reali.
