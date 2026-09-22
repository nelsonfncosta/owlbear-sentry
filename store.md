---
title: Sentry
description: Draw patrol routes and make tokens automatically walk them in Owlbear Rodeo.
author: "@nelsonfncosta"
image: https://nelsonfncosta.github.io/owlbear-sentry/patrol-demo.gif
icon: https://nelsonfncosta.github.io/owlbear-sentry/icons/patrol.svg
tags:
  - tool
  - automation
manifest: https://nelsonfncosta.github.io/owlbear-sentry/manifest.json
learn-more: https://github.com/nelsonfncosta/owlbear-sentry
---

# Sentry

Give tokens a route to patrol automatically in Owlbear Rodeo.

![Sentry patrol demo](https://nelsonfncosta.github.io/owlbear-sentry/patrol-demo.gif)

## Features

- Draw freehand patrol paths directly on the scene.
- Open paths make a token walk back and forth.
- Closed paths make a token loop continuously.
- Set a patrol speed per token.
- Pause, resume, or stop patrols from the token's Patrol context control.
- Tokens subtly turn to follow their path.
- Patrol movement updates token position, so it works with vision and fog of war.

## Usage

1. Select the Sentry tool from the toolbar.
2. Click and drag on the scene to draw a path.
3. Right-click a character token and choose `Patrol`.
4. Pick a path, set its speed, and select `Assign`.

Use the embedded Patrol controls to pause, resume, stop, or reassign a route.

## Install

Add this manifest URL in Owlbear Rodeo:

`https://nelsonfncosta.github.io/owlbear-sentry/manifest.json`
