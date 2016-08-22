cmd /c "apm install --packages-file packages.list"
cd packages-custom
for /D %%d in (*) do (
  cd %%d
  cmd /c "npm install"
  cmd /c "apm rebuild"
  cmd /c "apm link"
  cd ..\
)