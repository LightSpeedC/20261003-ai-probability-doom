// README.html の SVG 図を描画し、文字どうしの重なりと図からのはみ出しを検査する。
// 座標を手で決めた図は、描画しないと重なりに気づけないため（takeoff の図で実際に重なった）。
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// PlayWright はテストを CommonJS として読むため import.meta は使えない
const root = path.resolve(__dirname, '..');
const readme = pathToFileURL(path.join(root, 'README.html')).href;
const shotDir = path.join(root, 'tmp', 'shots');

test('README の SVG 図で文字が重ならず、図の外にはみ出さない', async ({ page }) => {
	fs.mkdirSync(shotDir, { recursive: true });
	await page.setViewportSize({ width: 1400, height: 1000 });
	await page.goto(readme);

	const problems = await page.evaluate(() => {
		const out: string[] = [];
		document.querySelectorAll('svg').forEach((svg, i) => {
			const box = svg.getBoundingClientRect();
			const texts = [...svg.querySelectorAll('text')].map(t => ({ s: t.textContent ?? '', r: t.getBoundingClientRect() }));
			for (const t of texts) {
				if (t.r.left < box.left - 1 || t.r.right > box.right + 1 || t.r.top < box.top - 1 || t.r.bottom > box.bottom + 1) {
					out.push(`図${i + 1}: はみ出し「${t.s}」`);
				}
			}
			// 文字に丸や縦横の線が刺さっていないか（年表で帯の名前に丸が乗り、物差しで見出しに線が刺さった）。
			// 斜めの矢印は外接矩形が広すぎて誤検出するので見ない。薄い目盛り線（#d9dfe8）も見ない
			const marks = [...svg.querySelectorAll('circle, line')].filter(e => {
				if (e.tagName === 'line') {
					const l = e as SVGLineElement;
					const straight = l.x1.baseVal.value === l.x2.baseVal.value || l.y1.baseVal.value === l.y2.baseVal.value;
					const stroke = l.getAttribute('stroke') ?? l.parentElement?.getAttribute('stroke') ?? '';
					return straight && stroke !== '#d9dfe8';
				}
				return true;
			}).map(e => e.getBoundingClientRect());
			for (const t of texts) {
				for (const m of marks) {
					const w = Math.min(t.r.right, m.right) - Math.max(t.r.left, m.left);
					const h = Math.min(t.r.bottom, m.bottom) - Math.max(t.r.top, m.top);
					// 縦横の線は外接矩形の幅（高さ）が 0 で返るので、0 でも重なりとみなす
					if (w >= 0 && h >= 0 && (w > 1 || h > 1) && Math.max(w, h) > 3) out.push(`図${i + 1}: 線か丸が刺さる「${t.s}」`);
				}
			}
			for (let a = 0; a < texts.length; a++) {
				for (let b = a + 1; b < texts.length; b++) {
					const p = texts[a].r, q = texts[b].r;
					const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
					const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
					// 行間の接触（数 px）は許し、文字が食い込む重なりだけを拾う
					if (w > 2 && h > 3) out.push(`図${i + 1}: 重なり「${texts[a].s}」と「${texts[b].s}」`);
				}
			}
		});
		return out;
	});

	const count = await page.locator('svg').count();
	for (let i = 0; i < count; i++) {
		await page.locator('svg').nth(i).screenshot({ path: path.join(shotDir, `fig${String(i + 1).padStart(2, '0')}.png`) });
	}

	expect(problems).toEqual([]);
});

test('README の img がすべて読み込め、引用元のリンクが付いている', async ({ page }) => {
	fs.mkdirSync(shotDir, { recursive: true });
	await page.setViewportSize({ width: 1400, height: 1000 });
	await page.goto(readme);
	const imgs = page.locator('figure img');
	const count = await imgs.count();
	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < count; i++) {
		const img = imgs.nth(i);
		await img.scrollIntoViewIfNeeded();
		// 置き場を誤るとブラウザは壊れた画像を出すだけでエラーにならないため、実際の幅で確かめる
		const loaded = await img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0);
		expect(loaded, `読み込めない画像: ${await img.getAttribute('src')}`).toBe(true);
		// 引用した画像には、出典のリンクを添えるため
		await expect(img.locator('xpath=ancestor::figure//figcaption//a')).toHaveCount(1);
		await img.locator('xpath=ancestor::figure').screenshot({ path: path.join(shotDir, `img${String(i + 1).padStart(2, '0')}.png`) });
	}
});
