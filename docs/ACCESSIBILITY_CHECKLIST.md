# Accessibility checklist

For Tiffany's testing. "Checked" means measured or confirmed in a real browser during the build. "To do" needs people and real devices.
Target: WCAG 2.2 AA, with the senior-friendly choices from the Week 1 pack.

## Checked during the build
| Item | Result |
|------|--------|
| Body text 22 px (proposal minimum 18 px) | Measured: 22 px |
| Tap targets 52-72 px, single taps only | Measured: answers 72 px, top-bar buttons 52 px, main buttons 64 px or more |
| Text contrast 4.5:1 or higher | Every text pair measures 8:1 or higher (ink on warm white 13.9, white on button blue 8.4, soft grey text 8.3, amber note text 9.1). Control borders (button blue, 7.9:1) and focus rings are 3:1 or higher; card outlines are decorative and lighter |
| Meaning never by colour alone | Right/not-quite always shows a symbol and words; highlights are bold and underlined, not just coloured |
| No red in the app interface | Done (the pop-up mock-ups M6 and M7 are red because real scam pop-ups are) |
| Read-aloud ("Listen") on every screen | Done, browser voice, starts on tap (works with iPhone's tap-to-play rule) |
| Icons labelled | Every icon sits next to a text label; icons are hidden from screen readers |
| Alt text on every image | Done (all 5 images, none missing) |
| Transcripts on every audio clip, with fallback if the file will not play | Done |
| One idea and one main action per screen; only Home/Stop and Listen at the top | Done |
| No timers or penalties in practice; time per answer is recorded silently | Done |
| Every screen shows "Training example"; AI-made items show "Made with AI for training" | Done |
| Page language set to Canadian English; skip link; visible focus ring; reduced-motion respected | Done |
| No page-wide sideways scrolling at 390 px wide | Checked on the example screens |
| Font: Atkinson Hyperlegible Next, loaded from Google Fonts, with system-font fallback | Needs an internet connection; to avoid a third-party request, self-host the font files |

## To do with people and devices
- [ ] Real iPhone and Android phone, plus one tablet, brightness turned down
- [ ] iPhone VoiceOver and Android TalkBack: can a person finish a round with the screen reader on?
- [ ] Browser zoom to 200% and larger system text sizes: nothing cut off
- [ ] "Listen" voice: is the browser voice clear and slow enough on the testers' own phones?
- [ ] Audio clips on a phone speaker (Mei)
- [ ] Alt text and transcripts read by Mei for accuracy
- [ ] A full WCAG 2.2 AA review (automated tool plus manual) before the final report
- [ ] Focus group feedback on the font, the wording ("It is a scam" / "It looks real") and the length of a round
