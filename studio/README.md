# Open Pose & Costume Studio

This directory contains the local Studio UI, Qwen and FLUX workflows, ComfyUI bridge,
and catalog scripts. The repository's main web app continues to use its own entry point.

On Windows, run `./studio/Start-Studio.ps1` from the repository root. It uses the
existing sibling `open-pose-costume-studio` installation for the offline gallery,
dependencies, Windows runtimes and model weights. Set `OPC_STUDIO_INSTALL` to use
an installation elsewhere. The launcher reuses already-running local services.
To load this checkout's UI and bridge, close the existing Studio UI and bridge
processes before starting the checkout. Keep any active generation job running
until it finishes.

The UI listens on port 5200, the bridge on 8192 and ComfyUI on 8189. No paid
fallback is configured in Studio. Large gallery files, model weights, runtimes,
logs and generated images are supplied locally. A Git pull updates the source.

To link the existing assets and dependencies without starting services, run
`./studio/Start-Studio.ps1 -PrepareOnly`. Run Studio's tests and build from
`studio/` with `npm test` and `npm run build` respectively.
