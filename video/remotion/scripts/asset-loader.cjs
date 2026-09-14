// Remap the app's root-relative URLs only inside the isolated video bundle.
module.exports = function (source) {
  let mapped = source.replace(
    /(["'`])\/(assets|textures)\/([\s\S]*?)\1/g,
    (_, quote, directory, value) =>
      `__videoAsset(${quote}${directory}/${value}${quote})`,
  );
  mapped = mapped.replace(
    /\b(src|href)=__videoAsset\(("[^"]*"|'[^']*')\)/g,
    "$1={__videoAsset($2)}",
  );
  return mapped === source
    ? source
    : `import {staticFile as __videoAsset} from 'remotion';\n${mapped}`;
};
