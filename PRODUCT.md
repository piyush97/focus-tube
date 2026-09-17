# FocusTube

## Summary

FocusTube turns YouTube discovery into a focused education feed. It keeps coding, software engineering, technical interview preparation, studying, and professional upskilling content visible while removing entertainment and uncertain recommendations.

## Users

- Software engineers and students who use YouTube to learn
- People preparing for coding and software engineering interviews
- Learners who want YouTube's catalog without its entertainment feed

## Core experience

1. User opens YouTube home, search, or a watch page.
2. New video cards stay concealed while FocusTube evaluates their title, channel, and page context.
3. Clearly relevant learning content appears; entertainment and uncertain cards remain hidden.
4. Toolbar panel shows filtering status, session counts, strictness, and a pause control.

## Scope

- Chrome and Firefox Manifest V3 extension
- YouTube home feed, search results, and watch-page recommendations
- Cloudflare Worker proxy to TypeSafe System One
- Strict by default: only high-probability educational/upskilling content appears
- Local decision cache; no browsing history or account data stored remotely

## Non-goals

- Blocking direct navigation to videos
- Filtering subscriptions, history, playlists, or channel pages
- Judging video quality, factual accuracy, or political viewpoint
- Parental controls or a general-purpose website blocker

## Platform

Browser extension for desktop Chrome and Firefox, with a Cloudflare Worker backend.

## Success

- Entertainment recommendations do not flash before filtering
- Relevant coding and learning videos remain discoverable
- User can pause filtering or tune strictness in one action
- TypeSafe API key never ships in extension code

## Privacy

Only visible video metadata required for classification is sent: title, channel, and YouTube surface. No cookies, account identity, watch history, comments, or video transcripts are sent.

## Assumptions

- English-language metadata in first release
- User supplies and deploys a Cloudflare Worker URL
- TypeSafe model is `jev-latest`
