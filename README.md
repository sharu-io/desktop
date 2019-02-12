<h1 align="center">
  <a href="https://sharu.io">
    <img src="https://sharu.io/sharu-top.jpeg" alt="sharu" />
  </a>
</h1>

<h3 align="center">finally, your data is safu</h3>
<h3 align="center">bring back the u to filesharing</h3>

<div align="center">
<img alt="demo" src="https://sharu.io/sharu.gif" width="80%" />
</div>

### Project status - `friendly openbeta`

# Binary downloads

- [linux](https://gateway.ipfs.io/ipfs/QmYqo3BfnZfPAcEj2r5MGMqWWCwcQYFPgeXiBZ6w95zeBb/sharu-1.0.0.AppImage)
- [mac](https://gateway.ipfs.io/ipfs/QmYqo3BfnZfPAcEj2r5MGMqWWCwcQYFPgeXiBZ6w95zeBb/sharu-1.0.0.dmg)
- [windows](https://gateway.ipfs.io/ipfs/QmYqo3BfnZfPAcEj2r5MGMqWWCwcQYFPgeXiBZ6w95zeBb/sharu-1.0.0.exe)

# Changelog

 ## v 1.0.0
- fixed [nounce has already been used](https://github.com/sharu-io/desktop/issues/12)
- show [warnings when retrying a failed long-running-activity](https://github.com/sharu-io/desktop/issues/2)
- show [filesizes](https://github.com/sharu-io/desktop/issues/4)
- less greedy pinning
- correct handling of [socket hangups](https://github.com/sharu-io/desktop/issues/3)

 ## v 0.1.3

 - switching back to js-ipfs
- basic deuglyfication of the code
- app is opensource now :D

# Upgrading
## versions < 0.1.3

If you have installed one of the previous version 0.1.0 - 0.1.2 you have an incompatible ipfsd-config and cannot run the latest version. you need to delete the user-data before launching. sorry about this, we hope that this is not going to happen again (as we believe we use the "right" ipfs-implementation now ;-)

### linux

```bash
rm -rf ~/.config/sharu
```

### osx

```bash
rm -rf ~/Library/Application\ Support/sharu
```

### windows

open explorer, navigate to ``%APPDATA%`` and remove the folder ``sharu``

# Building from source

```bash
npm i
npm run start
```

## Building a release

```bash
npm i
npm run electron:$platform
```
`$platform` can be `linux`, `windows` or `mac`

You will find the binary build in the subdirectory `releases`.

# Troubleshooting

Please don't hesitate and open a ticket [here](https://github.com/sharu-io/desktop/issues)
