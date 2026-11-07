"""One visible, opt-in desktop action. No shell or arbitrary code execution."""
import base64
import io
import json
import sys
import time
import pyautogui as gui
import pyperclip

gui.FAILSAFE = True  # Move mouse to top-left to stop the current action.
gui.PAUSE = 0.2
action = json.load(sys.stdin)
kind = action.get('type')
if kind == 'click':
    x, y = action.get('x'), action.get('y')
    width, height = gui.size()
    if type(x) is not int or type(y) is not int or not (0 <= x < width and 0 <= y < height):
        raise ValueError('Koordinat di luar layar utama')
    gui.click(x, y)
elif kind == 'type':
    text = action.get('text')
    if not isinstance(text, str) or len(text) > 2000:
        raise ValueError('Teks tidak valid')
    old = pyperclip.paste()
    try:
        pyperclip.copy(text)
        gui.hotkey('ctrl', 'v')
        time.sleep(0.3)
    finally:
        pyperclip.copy(old)
elif kind == 'key':
    key = action.get('key')
    if key not in ['enter', 'tab', 'escape', 'backspace', 'up', 'down', 'left', 'right', 'space']:
        raise ValueError('Tombol tidak diizinkan')
    gui.press(key)
elif kind == 'scroll':
    amount = action.get('amount')
    if type(amount) is not int or abs(amount) > 10:
        raise ValueError('Scroll tidak valid')
    gui.scroll(amount)
elif kind != 'screenshot':
    raise ValueError('Aksi tidak diizinkan')
time.sleep(0.25)
screen = gui.screenshot()
buffer = io.BytesIO()
screen.convert('RGB').save(buffer, format='JPEG', quality=65)
print(json.dumps({'image': 'data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii'), 'width': screen.width, 'height': screen.height}))
