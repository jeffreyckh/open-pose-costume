# Local PoseAtlas adapter

Run from this Studio folder:

```powershell
npm run atlas:import
# Audit only, or choose another local checkout:
node scripts/import-pose-atlas.mjs --source=D:/AI/RuiC-PoseAtlas
```

The existing Pose, Costume and Character screens and generation reference slots are used. No new page, model download, network request or GPU job is needed. PoseAtlas contains reference pictures, not OpenPose joint/keypoint JSON; importing pictures does not install a ControlNet model or guarantee pose/identity transfer.

The current atlas maps to all 288 pose groups (1,439 angles), 1,407 costumes and 1,499 portraits already available locally. Pose series aliases preserve existing selection IDs. Existing richer translated titles and categories are retained. The three hero examples are additional entries; corrected totals are 3,197 references and 4,348 pictures.

Original portrait files are absent from this atlas checkout. Existing Studio portrait files supply all 1,499 entries without remote fetching. New atlas entries whose source files are unavailable are reported instead of becoming broken image cards.

`local/atlas-import/report.json` records matching IDs, additions and missing assets. `catalog.before.json` preserves the catalog before the first application. Original atlas files are read only. The atlas MIT notice is retained alongside the import report; existing third-party image notices remain intact.

Validation: all 8,693 unique catalog image/thumbnail files exist locally, with zero external references. Three sampled pose originals are byte-identical. Costume samples share the same design and dimensions but differ in encoding/pixels; the existing PNG originals are retained rather than replaced with the atlas WebP images. The running local server serves the corrected catalog.
