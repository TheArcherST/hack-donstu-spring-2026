Pole Asset Pack — Engine-Friendly v2

What was improved:
- Every piece is centered to one shared vertical pole axis.
- Standardized canvas width: 256 px.
- Binary masks included for simple collision / hitzones / trigger volumes.
- Added a default repeat piece for infinite upward stacking.
- Added two atlases:
  1) atlas_exact_stack.png — exact sizes for precise slicing.
  2) atlas_256_cells.png — simple 256x256 cell grid for quick import.

Recommended assembly order:
bottom_post -> control_box -> cable_bundle -> repeat_tile_256w (repeat as needed) -> top_exit

Import notes:
- Use the stack_axis_x value from manifest.json to align all pieces on the same X.
- Prefer the individual aligned PNGs when visual fidelity matters.
- Prefer repeat_tile_256w.png as the default endlessly repeated middle section.
