import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import { glob } from 'glob';

(async () => {
  const patterns = [
    'public/assets/**/*.{jpg,jpeg,png}',
    'public/*.{jpg,jpeg,png}'
  ];
  const files = await glob(patterns, { ignore: 'node_modules/**' });
  console.log(`Optimizing ${files.length} images...`);
  const result = await imagemin(files, {
    destination: '.',
    plugins: [
      imageminMozjpeg({ quality: 75 }),
      imageminPngquant({ quality: [0.6, 0.8] })
    ]
  });
  console.log('Optimized images:');
  result.forEach(file => console.log(file.destinationPath));
  console.log('Image optimization complete');
})().catch(console.error);