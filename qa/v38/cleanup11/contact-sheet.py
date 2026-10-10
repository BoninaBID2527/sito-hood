"""Local visual review sheets; original frames remain the evidence."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

out = Path('/workspace/scratch/cleanup11-contact')
out.mkdir(parents=True, exist_ok=True)
for folder in sys.argv[1:]:
    files = sorted(Path(folder).glob('*.png'))
    for start in range(0, len(files), 8):
        canvas = Image.new('RGB', (800, 1000), '#151515')
        draw = ImageDraw.Draw(canvas)
        for j, path in enumerate(files[start:start + 8]):
            frame = Image.open(path).convert('RGB')
            frame.thumbnail((400, 225))
            x, y = j % 2 * 400, j // 2 * 250
            canvas.paste(frame, (x, y))
            draw.text((x + 4, y + 228), path.stem, fill='white')
        canvas.save(out / f'{Path(folder).name}-{start // 8 + 1}.jpg', quality=94)

