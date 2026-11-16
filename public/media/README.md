# Media

| ID | File | Used by | What it is | Made with AI label |
|----|------|---------|------------|--------------------|
| M1 | images/m1.jpg | S07 | Fictional "Richard" profile photo (AI image) | Yes |
| M2 | audio/m2.mp3 | S08 | Voicemail, "We have your granddaughter" (synthetic voices) | Yes |
| M3 | audio/m3.mp3 | S10 | Voicemail, "Your computer has a virus" (synthetic voice) | Yes |
| M4 | audio/m4.mp3 | S11 | Call recording, "I got arrested" (synthetic voice, same as M5) | Yes |
| M5 | audio/m5.mp3 | S12 | Call recording, "I was in a car accident" (synthetic voice, same as M4) | Yes |
| M6 | images/m6.jpg | S15 | "Microsoft" pop-up mock-up (carries a TRAINING EXAMPLE banner) | No |
| M7 | images/m7.jpg | S16 | "Apple" pop-up mock-up (carries a TRAINING EXAMPLE banner) | No |
| M8 | images/m8.jpg | S17 | Fictional TV host still (AI image); caption is a text layer in the app | Yes |
| M9 | images/m9.jpg | S18 | Fictional economist still (AI image); caption is a text layer in the app | Yes |

To replace a file, overwrite it with the same name. For audio keep it mono, under 30 seconds, and keep the transcript in
`content/scenarios.json` identical to what is said. Then bump the content version (`npm run release -- content-patch "..."`).
