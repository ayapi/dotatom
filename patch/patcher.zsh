for f in $HOME/.atom/patch/*.patch; do
  sudo patch -p1 < $f
done