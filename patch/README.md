# 準備
```sh
npm install -g asar
```

# atomインストールディレクトリどこ
## Arch Linux
community/atom でインストールしてれば `/usr/lib/atom`

## Windows
```
%userprofile%\AppData\Local\atom\app-【atomバージョン】\
```

## Mac
たぶん `/Applications/Atom.app/Contents` か、 `~/Applications/Atom.app/Contents`

以下ゎこのpathを`atom_installed_dir`とかく

# patchのっくりかた
```sh
cd atom_installed_dir
cd resources
asar e app.asar app_unpacked
cp -r app_unpacked app_modified
```

そしたらapp_modified以下のファイルを編集する  
ぉゎったら

```sh
diff -urN app_unpacked app_modified > path_to_patch.patch
rm -rf app_unpacked
rm -rf app_modified
```

`path_to_patch.patch`ゎ、  
このREADME.mdがぁるディレクトリに、すきなbasenameで、  
拡張子を`.patch`にする、ってことにした

# patchをぜんぶ一気にぁてるゃりかた

## Arch Linux, Mac

```sh
cd atom_installed_dir
```

のぁとに、

```sh
~/.atom/patch/patcher.zsh
```

でぉゎり

## Windows

```sh
cd atom_installed_dir
```
のぁとに、

```bat
%userprofile%\.atom\patch\patcher.bat
```

# patchのぁてかた(個別)
```sh
cd atom_installed_dir
cd resources
asar e app.asar app_unpacked
patch -p0 < path_to_patch.patch
mv -f app.asar app_original.asar
asar p app_unpacked app.asar
rm -rf app_unpacked
```

# 元に戻すにゎ
```sh
rm app.asar
mv app_original.asar app.asar
```
