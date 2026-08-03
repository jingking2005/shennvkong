#!/usr/bin/env python3
"""启动烟雾测试（OC-01）：遍历主要页面，60 秒内 Console 0 Error/Warning。

用法：python3 scripts/smoke_test.py [base_url]
退出码：0 = 通过；1 = 有 console error/warning 或资源加载失败；2 = 环境错误。
"""
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4517'
BUDGET_SEC = 55

# 底部导航（1280x760，scale=1 时的游戏坐标）
NAV = [
    ('召唤', 225, 727),
    ('仓库', 353, 727),
    ('商店', 480, 727),
    ('活动', 610, 727),
    ('出击', 740, 727),
    ('队伍', 865, 727),
    ('战绩', 995, 727),
]


def ensure_server() -> subprocess.Popen | None:
    try:
        urllib.request.urlopen(BASE, timeout=2)
        return None
    except Exception:
        pass
    proc = subprocess.Popen(
        ['npx', 'vite', 'preview', '--port', BASE.rsplit(':', 1)[-1]],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        try:
            urllib.request.urlopen(BASE, timeout=2)
            return proc
        except Exception:
            time.sleep(1)
    proc.kill()
    print('FAIL: vite preview 启动超时', file=sys.stderr)
    sys.exit(2)


def main() -> int:
    server = ensure_server()
    problems: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1280, 'height': 760})
            page.on('console', lambda m: problems.append(f'console.{m.type}: {m.text}')
                    if m.type in ('error', 'warning') else None)
            page.on('pageerror', lambda e: problems.append(f'pageerror: {e}'))

            start = time.time()
            page.goto(BASE)
            page.wait_for_timeout(2500)

            # 新档必有每日签到弹窗：领取后关闭
            page.mouse.click(639, 553)
            page.wait_for_timeout(800)

            for name, x, y in NAV:
                if time.time() - start > BUDGET_SEC:
                    problems.append(f'超时：未遍历到页面 {name}')
                    break
                page.mouse.click(x, y)
                page.wait_for_timeout(1200)

            # 资源诊断
            diag = page.evaluate('window.__assetDiag || { failed: [] }')
            for entry in diag.get('failed', []):
                problems.append(f"asset:{entry['kind']}: {entry['src']}")

            browser.close()
    finally:
        if server:
            server.terminate()

    if problems:
        print(f'FAIL ({len(problems)} 个问题):')
        for p_ in problems:
            print(' -', p_)
        return 1
    print('PASS: 页面遍历完成，Console 0 Error/Warning，资源加载无失败')
    return 0


if __name__ == '__main__':
    sys.exit(main())
