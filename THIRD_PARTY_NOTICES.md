# Third-party notices

Check It's redaction (`src/lib/check/ca-patterns.ts` and `src/lib/check/names.ts`) uses one library and adapts patterns from three open-source projects. Full licence texts are in [`licenses/`](licenses/). The photo reader, Tesseract.js (Apache-2.0), is a normal npm dependency.

## Library used (unmodified)

| Project | Version | Licence | How we use it |
| --- | --- | --- | --- |
| [compromise](https://github.com/spencermountain/compromise) | 14.20.0 (pinned) | MIT ([text](licenses/compromise-MIT.txt)) | npm dependency, not modified. Finds likely names in the text of a message, on the phone. Loaded only when Check It needs it. |

PR #1 used [image-pii-redactor](https://github.com/athal7/image-pii-redactor) (MPL-2.0) for this. It is not used: its name model (`onnx-community/multilang-pii-ner-ONNX`) downloads about 279 MB to each phone.

## Patterns adapted

The rules in `src/lib/check/ca-patterns.ts` are written in TypeScript for this project, not copied. The parts that came from the team's PR #1 adapt these sources:

| Project | Version checked | Licence | Copyright | What we adapted |
| --- | --- | --- | --- | --- |
| [Microsoft Presidio](https://github.com/microsoft/presidio) (`presidio-analyzer`) | 2.2.366 | MIT ([text](licenses/presidio-MIT.txt)) | Copyright (c) Presidio Contributors | `CaSinRecognizer` (3-3-3 SIN shape) and `CaPostalCodeRecognizer` (Canada Post letter sets) |
| [canpii](https://pypi.org/project/canpii/) | 0.1.0 | Apache-2.0 ([text](licenses/canpii-Apache-2.0.txt), [NOTICE](licenses/canpii-NOTICE.txt)) | Copyright 2026 Arthur Jin and canpii contributors | Health number shapes: Ontario OHIP (4-3-3 plus version code), BC PHN, Alberta (5-4), Quebec RAMQ (4 letters + 8 digits); health-card context words |
| [wuming](https://github.com/taoq-ai/wuming) | commit 861d355 | MIT ([text](licenses/wuming-MIT.txt)) | Copyright (c) 2026 TaoQ AI Labs | Canadian phone, SIN, email and card number pattern shapes |

### Changes we made (Apache-2.0 section 4b)

- We hide any 3-3-3 or 9-digit ID number, not only valid SINs, so Saskatchewan, Alberta and Manitoba health numbers are hidden too. Card numbers are hidden whether or not they pass a Luhn check, because a photo can misread a digit.
- Matches are decided by nearby words ("SIN", "health card", "code", "verification") within a short window, instead of confidence scores.
- Emails: we hide only the part before the @ and keep the domain. Links: we keep the domain and hide the path and tracking codes, including a part that wrapped onto the next line.
- New rules not in the sources: card expiry and CVV, one-time codes and PINs, and birth dates.
- No pattern uses look-behind, so the file loads on iPhones older than iOS 16.4.

None of these projects endorse this app.
