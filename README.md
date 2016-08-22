## install packages
### on linux
まだかぃてなぃ

### on windows
```bat
cd %userprofile%\.atom
install-packages.bat
```

## configure node-gyp of apm on windows

windowsでgyp関係のエラーがでたとき

### install windows-build-tools
pythonとMSVS C++なんちゃら～を一気に設定してくれるゃっ  
コマンドプロンプトを「管理者として実行」で起動してから、

```sh
npm install --global --production windows-build-tools
```

### set config values to apm
apmゎ独自にnpmを持ってて、グローバルのnpmとゎべっだから設定を合ゎせる必要がぁる
`python`と`msvs_version`の値をぉなじにする

```sh
npm config get python | clip
apm config set python 【クリップボードからペースト】
npm config get msvs_version | clip
apm config set msvs_version 【クリップボードからペースト】
```
