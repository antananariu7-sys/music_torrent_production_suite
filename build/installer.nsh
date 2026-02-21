!macro customUnInstall
  MessageBox MB_YESNO "Also remove user settings and app data?$\n(Your projects will NOT be affected)" IDYES removeData IDNO keepData
  removeData:
    RMDir /r "$APPDATA\music-production-suite"
  keepData:
!macroend
