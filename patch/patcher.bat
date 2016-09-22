cd resources
cmd /c "asar e app.asar app_unpacked"
for %%I in (%userprofile%\.atom\patch\*.patch) do cmd /c "patch -p0 < %%I"
mv -f app.asar app_original.asar
cmd /c "asar p app_unpacked app.asar"
rm -rf app_unpacked
cd ..\
