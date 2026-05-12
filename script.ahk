; Simple AutoHotkey script for testing
; This script will show a tray tip when started

#Persistent
TrayTip, Remote AHK Control, AutoHotkey script is running!, 3, 1
Return

; Example hotkey - press F12 to show message
F12::
    MsgBox, AutoHotkey is active! Remote control working.
Return