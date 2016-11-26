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

## update atom

atom自体をアップデートすると、  
native moduleをっかってるパッケージがエラーになることがょくぁる  

そのだめっぽぃパッケージがぁるディレクトリにぃってから、

```sh
apm rebuild
```

をゃる

もし、アプデしてから `rebuild` をゃるょり前にatomを起動しちゃった場合、  
`rebuild` をしてもまだエラーが出続けることがぁる

その場合atomのdevtoolsを起動して、  
local storageの一覧から「incompatible package」みたぃな文字列が  
キーに含まれてるレコードを探して、削除して、atomを再起動する
