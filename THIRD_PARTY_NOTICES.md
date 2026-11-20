# Third-party notices

Check It's redaction (`src/lib/redaction/`) uses one library and adapts patterns from three open-source projects. Full licence texts are in [`licenses/`](licenses/).

## Library used (unmodified)

| Project | Version | Licence | How we use it |
| --- | --- | --- | --- |
| [image-pii-redactor](https://github.com/athal7/image-pii-redactor) | 0.10.1 (pinned) | MPL-2.0 | npm dependency, not modified. Reads the screenshot on the phone (Tesseract.js) and finds names and addresses (onnx-community/multilang-pii-ner-ONNX). Its built-in patterns are switched off. |

## Patterns adapted

Our rules in `src/lib/redaction/ca-patterns.ts` are rewritten in TypeScript, not copied. They adapt these sources:

| Project | Version checked | Licence | Copyright | What we adapted |
| --- | --- | --- | --- | --- |
| [Microsoft Presidio](https://github.com/microsoft/presidio) (`presidio-analyzer`) | 2.2.366 | MIT ([text](licenses/presidio-MIT.txt)) | Copyright (c) Presidio Contributors | `CaSinRecognizer` (3-3-3 SIN shape, consistent separator) and `CaPostalCodeRecognizer` (Canada Post letter sets) |
| [canpii](https://pypi.org/project/canpii/) | 0.1.0 | Apache-2.0 ([text](licenses/canpii-Apache-2.0.txt), [NOTICE](licenses/canpii-NOTICE.txt)) | Copyright 2026 Arthur Jin and canpii contributors | Health number shapes: Ontario OHIP (4-3-3 plus version code), BC PHN, Alberta (5-4), Quebec RAMQ (4 letters + 8 digits); Luhn check; BC PHN MOD-11 check |
| [wuming](https://github.com/taoq-ai/wuming) | commit 861d355 | MIT ([text](licenses/wuming-MIT.txt)) | Copyright (c) 2026 TaoQ AI Labs | Canadian phone (`ca/phone`), SIN (`ca/sin`), email (`common/email`) and card number (`common/creditcard`) patterns |

### Changes we made (Apache-2.0 section 4b)

- We hide any 3-3-3 or 9-digit ID number, not only valid SINs. Presidio requires a first digit of 1–7 or 9 and a passing Luhn check; we drop both so Saskatchewan, Alberta and Manitoba health numbers are hidden too.
- Matches are decided by nearby words ("SIN", "health card", "code") within a short window, instead of Presidio-style confidence scores.
- Emails: we hide only the part before the @ and keep the domain. Links: we keep the domain and hide tracking codes, including a part that wrapped onto the next line.
- New rules not in the sources: card expiry and CVV when labelled, one-time codes and PINs near "code" or "PIN", and birth dates near "birth" or "born".

Neither canpii nor the other projects endorse this app.
