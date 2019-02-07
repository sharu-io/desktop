# sharu

finally, your data is safu

bring back the u to filesharing

# Changelog

## v 0.1.4
- fixed [nounce has already been used](https://github.com/sharu-io/desktop/issues/12)
- show [warnings when retrying a failed long-running-activity](https://github.com/sharu-io/desktop/issues/2)

## v 0.1.3

- switching back to js-ipfs
- basic deuglyfication of the code
- app is opensource now :D

# binary downloads
- [linux](https://gateway.ipfs.io/ipfs/QmbSafe3bguDxkd7ApJws8nfDswRT3TJHaFvdWpmEpnJyg/sharu-0.1.3.AppImage)
- [mac](https://gateway.ipfs.io/ipfs/QmbSafe3bguDxkd7ApJws8nfDswRT3TJHaFvdWpmEpnJyg/sharu-0.1.3.dmg)
- [windows](https://gateway.ipfs.io/ipfs/QmbSafe3bguDxkd7ApJws8nfDswRT3TJHaFvdWpmEpnJyg/sharu-0.1.3.exe)

# important: upgrading from previous versions
If you have installed one of the previous version 0.1.0 - 0.1.2 you have an incompatible ipfsd-config and cannot run the latest version. you need to delete the user-data before launching. sorry about this, we hope that this is not going to happen again (as we believe we use the "right" ipfs-implementation now ;-)

## linux
``rm -rf ~/.config/sharu`` from a terminal
## windows
open explorer, navigate to ``%APPDATA%`` and remove the folder ``sharu``
## osx
remove ``/Users/$USER/Library/Application\ Support/sharu/``

# troubleshooting
- in case you receive a "socket hangup" on downloading, just restart the app - looks like the streaming between the app and ipfsd has still some issues. could happen that the download is already finished

