import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/*
 * A dictionary and a t(). No i18n library: there are two languages and one
 * bundle to keep small.
 *
 * What is not translated, on purpose: openssl's own output and the error text
 * it returns. That is machine output, and people match it against manpages and
 * search results, so it stays in the language openssl speaks.
 */

const EN = {
  'lang.switch': 'Switch to Chinese',
  'lang.button': '中',

  'skip.tool': 'Skip to the tool',
  'nav.tools': 'Tools',
  'nav.reshape': 'Reshape',
  'nav.check': 'Check',
  'nav.create': 'Create',

  'head.wordmark': 'Certificate Toolbox',
  'head.ephemeral': 'Nothing is stored',
  'head.toLight': 'Switch to the light theme',
  'head.toDark': 'Switch to the dark theme',

  'foot.temp':
    'Uploads are processed in a temporary directory and deleted straight away. Each download link works once, and expires an hour after it is made.',
  'foot.selfhost': 'Runs entirely on your own host.',

  /* ---- tools ---- */
  'tool.pfx-extract.label': 'Unpack a PFX',
  'tool.pfx-extract.title': 'Unpack a PFX into a key and a certificate',
  'tool.pfx-extract.blurb':
    'Pull the certificate and private key back out of a PKCS#12 bundle, ready to drop into nginx or Apache.',

  'tool.pfx-create.label': 'Build a PFX',
  'tool.pfx-create.title': 'Build a PFX from a key and a certificate',
  'tool.pfx-create.blurb':
    'Pack a private key, its certificate and any intermediates into one PKCS#12 bundle for Windows, IIS or a Java keystore.',

  'tool.chain-merge.label': 'Merge a chain',
  'tool.chain-merge.title': 'Merge a certificate with its intermediates',
  'tool.chain-merge.blurb':
    'Combine a certificate and its intermediates into one fullchain.pem, ordered leaf to root. No private key needed, and PEM or DER both work.',

  'tool.convert.label': 'PEM and DER',
  'tool.convert.title': 'Convert between PEM and DER',
  'tool.convert.blurb':
    'The same certificate, written the other way round. The input encoding is detected from the bytes, so a misnamed file is fine.',

  'tool.chain.label': 'Chain in a file',
  'tool.chain.title': 'Check a chain held in files',
  'tool.chain.blurb':
    'Find out whether the certificates you have link all the way up to a self-signed root, and which intermediate is missing when they do not.',

  'tool.url.label': 'Chain on a server',
  'tool.url.title': 'Check the chain a live server presents',
  'tool.url.blurb':
    'Connect to a running host and read back the chain it actually serves. This is how you catch the missing intermediate that works in your browser but breaks curl.',

  'tool.inspect.label': 'Read a certificate',
  'tool.inspect.title': 'Read what is inside a certificate',
  'tool.inspect.blurb':
    'Decode a certificate and show every field: subject, issuer, validity, extensions and alternative names.',

  'tool.csr.label': 'New key and CSR',
  'tool.csr.title': 'Generate a key and a signing request',
  'tool.csr.blurb':
    'Create a fresh private key and the CSR to send to your certificate authority, with every hostname listed as a subject alternative name.',

  'tool.remove-pass.label': 'Unlock a key',
  'tool.remove-pass.title': 'Remove the passphrase from a private key',
  'tool.remove-pass.blurb': 'Strip the passphrase so a service can start without someone typing it in.',

  /* ---- shared controls ---- */
  'ui.required': 'required',
  'ui.files': '{n} files',
  'ui.file': '{n} file',
  'ui.dropOne': 'Drop a file here, or click to browse',
  'ui.dropMany': 'Drop one or more files here, or click to browse',
  'ui.choose': 'Choose a file',
  'ui.remove': 'Remove {name}',
  'ui.addAnother': 'Add another file',
  'ui.working': 'Working',
  'ui.need': 'Add {need} to continue.',
  'ui.failed': 'That did not work',
  'ui.produced': 'Files produced',
  'ui.producedAside': 'each link works once, then expires',
  'ui.download': 'Download',
  'ui.downloaded': 'Downloaded',
  'ui.copy': 'Copy',
  'ui.copied': 'Copied',
  'ui.commands': 'Equivalent OpenSSL commands',
  'ui.commandsAside': 'run these yourself to get the same result',

  'ui.leaf': 'Leaf',
  'ui.intermediate': 'Intermediate',
  'ui.root': 'Root (self-signed)',
  'ui.signedBy': 'signed by {issuer}',
  'ui.validRange': 'Valid {from} to {to}, {remain}',
  'ui.expiredAgo': 'expired {span} ago',
  'ui.notYet': 'not valid yet',
  'ui.left': '{span} left',
  'ui.days': '{n} d',
  'ui.months': '{n} mo',
  'ui.years': '{n} y',

  /* ---- fields shared between panels ---- */
  'f.cert': 'Certificate',
  'f.chain': 'Intermediates and root',
  'f.key': 'Private key',

  /* ---- unpack a PFX ---- */
  'p.extract.file': 'PKCS#12 bundle',
  'p.extract.fileHint': 'A .pfx or .p12 holding the certificate and its private key.',
  'p.extract.pw': 'Bundle password',
  'p.extract.pwHint': 'Leave empty if the bundle has no password.',
  'p.extract.strip':
    'Decrypt the private key too, so nginx and Apache can load it without a passphrase prompt. Written as',
  'p.extract.go': 'Extract',
  'p.extract.need': 'a PKCS#12 bundle',
  'p.extract.fix':
    "Wrong password is the usual cause. Bundles written by older tools may also need OpenSSL's legacy provider, which this tool retries with automatically.",

  /* ---- build a PFX ---- */
  'p.create.chainHint':
    'Add the intermediate and the root as separate files, or one bundle holding both. Include them so the importing server presents a complete chain.',
  'p.create.exportPw': 'Password to protect the new bundle',
  'p.create.keyPw': 'Password on the private key',
  'p.create.keyPwHint': 'Only needed if the key you uploaded is encrypted.',
  'p.create.legacy':
    'Write with legacy algorithms, for Windows and IIS versions that reject OpenSSL 3 defaults',
  'p.create.go': 'Create bundle',
  'p.create.need': 'a private key and a certificate',
  'p.create.fix':
    'If OpenSSL reports a key and certificate mismatch, the two files belong to different certificates.',

  /* ---- merge a chain ---- */
  'p.merge.certHint': 'The leaf certificate, the one issued for your hostname. PEM or DER.',
  'p.merge.chainHint':
    'Add the intermediate and the root as separate files, or one bundle holding both. Order does not matter, and PEM and DER can be mixed.',
  'p.merge.includeRoot':
    'Keep the self-signed root in the output. Web servers normally leave it out, since clients already trust it.',
  'p.merge.go': 'Merge into fullchain.pem',
  'p.merge.need': 'a certificate',
  'p.merge.done': 'Merged',
  'p.merge.doneSub': '{n} certificates, ordered leaf to root',
  'p.merge.doneSub1': '1 certificate',

  /* ---- PEM and DER ---- */
  'p.convert.certHint': 'The encoding is detected from the file itself, not from its extension.',
  'p.convert.out': 'Write it as',
  'p.convert.pem': 'PEM — Base64 text, for nginx, Apache and most Unix tooling',
  'p.convert.der': 'DER — raw binary, for Java keystores and Windows tooling',
  'p.convert.go': 'Convert',
  'p.convert.detected': 'Read the input as',

  /* ---- chain in a file ---- */
  'p.check.certHint': 'The leaf certificate.',
  'p.check.chainHint':
    'Add the intermediate and the root as separate files if that is how you received them. Skip this if the leaf file already holds the whole chain.',
  'p.check.go': 'Check the chain',
  'p.check.ok': 'Chain is complete',
  'p.check.okSub': 'every certificate links to its issuer, up to a self-signed root',
  'p.check.bad': 'Chain is incomplete',
  'p.check.badSub': 'at least one issuer is missing, so clients cannot build a path to a trusted root',
  'p.check.unused': 'Not part of the path:',

  /* ---- chain on a server ---- */
  'p.url.host': 'Host',
  'p.url.hostHint': 'A bare hostname, a full URL, or host:port. Port 443 is assumed.',
  'p.url.go': 'Check the server',
  'p.url.note': 'Connects from this server, not from your browser.',
  'p.url.need': 'a hostname',
  'p.url.fix': 'Check the hostname and that this server can reach it on the port given.',
  'p.url.ok': 'Chain is complete and trusted',
  'p.url.bad': 'The server is not presenting a usable chain',
  'p.url.protocol': 'Protocol',
  'p.url.cipher': 'Cipher',
  'p.url.verify': 'Verify',

  /* ---- CSR ---- */
  'p.csr.cn': 'Common name',
  'p.csr.cnHint': 'The primary hostname the certificate is for.',
  'p.csr.san': 'Subject alternative names',
  'p.csr.sanHint':
    'Comma or space separated. DNS names and IP addresses are told apart automatically. Browsers ignore the common name, so list every hostname here.',
  'p.csr.o': 'Organization',
  'p.csr.ou': 'Organizational unit',
  'p.csr.l': 'City',
  'p.csr.st': 'State or province',
  'p.csr.c': 'Country',
  'p.csr.email': 'Email',
  'p.csr.key': 'Key',
  'p.csr.rsa2048': 'RSA 2048 — accepted everywhere',
  'p.csr.rsa4096': 'RSA 4096 — slower handshakes, longer margin',
  'p.csr.ecp256': 'EC P-256 — smaller and faster, modern clients',
  'p.csr.ecp384': 'EC P-384',
  'p.csr.keyPw': 'Password for the new key',
  'p.csr.keyPwHint': 'Leave empty for a key your web server can load unattended.',
  'p.csr.go': 'Generate key and request',
  'p.csr.need': 'a common name',
  'p.csr.says': 'What the request says',
  'p.csr.saysAside': 'check this before sending it to the CA',

  /* ---- unlock a key ---- */
  'p.pass.key': 'Encrypted private key',
  'p.pass.current': 'Current passphrase',
  'p.pass.go': 'Remove the passphrase',
  'p.pass.note': 'The result is an unprotected key. Keep it readable only by root.',
  'p.pass.need': 'the key and its passphrase',
  'p.pass.fix': 'OpenSSL reports a bad decrypt when the passphrase is wrong.',

  /* ---- read a certificate ---- */
  'p.inspect.certHint': 'PEM or DER. Use this to find out what an unlabelled file actually contains.',
  'p.inspect.go': 'Decode it',
  'p.inspect.out': 'Certificate contents',
  'p.inspect.fix':
    'If OpenSSL cannot parse the file, it may be a PKCS#12 bundle or a private key rather than a certificate.',

  /* ---- messages the server sends back ---- */
  'w.noIssuer':
    'Could not find the issuer of "{subject}" among the supplied certificates — an intermediate may be missing.',
  'w.leftOut': 'Left out of the bundle, not part of this chain: {subjects}',
  'w.unordered': 'Certificates could not be auto-ordered; kept them in the order supplied.',
  'w.missingIntermediate':
    'Missing intermediate: issuer "{issuer}" of "{subject}" was not found in the supplied files.',
  'w.noRoot': 'Chain does not terminate in a self-signed root certificate (root not supplied).',
  'w.serverMissingIntermediate':
    'Server is missing an intermediate certificate — clients that do not fetch it themselves will fail to verify this site.',
  'w.noCaBundle': 'No system CA bundle available to confirm trust; showing structural analysis only.',
  'w.badOrder': 'The certificates were not sent in a proper leaf → root order (or a link is missing).',

  /* ---- reference ---- */
  'kb.title': 'Which file is which',
  'kb.sub': 'formats, extensions and what each one holds',
  'kb.intro':
    'Every certificate follows the X.509 standard. The PKCS standards from RSA Labs define the containers around it, and in practice you meet three: #7 for chains, #10 for requests, and #12 for a certificate bundled with its key. The trap is that a file extension tells you almost nothing about the format inside.',
  'kb.headFormat': 'Format',
  'kb.headExt': 'Extensions in the wild',
  'kb.headEnc': 'Encoding',
  'kb.headKey': 'Holds a key',
  'kb.headHolds': 'What is inside',
  'kb.encBinary': 'Binary',
  'kb.encBase64': 'Base64 text',
  'kb.encEither': 'DER or PEM',
  'kb.encPem': 'PEM, sometimes DER',
  'kb.no': 'No',
  'kb.yesPw': 'Yes, password protected',
  'kb.isKey': 'It is the key',
  'kb.derFmt': 'X.509 certificate, DER',
  'kb.derHolds': 'One certificate, stored as raw bytes.',
  'kb.pemFmt': 'X.509 certificate, PEM',
  'kb.pemHolds':
    'One or more certificates in Base64, each wrapped in -----BEGIN CERTIFICATE-----.',
  'kb.p12Fmt': 'PKCS#12',
  'kb.p12Holds':
    'Certificate, chain and private key in one file. This is how an identity moves between systems.',
  'kb.p7Fmt': 'PKCS#7',
  'kb.p7Holds': 'A chain of certificates and nothing else. A .p7r is a reply from a CA.',
  'kb.csrFmt': 'PKCS#10, a CSR',
  'kb.csrHolds': 'A signing request: what you send a CA to have a certificate issued.',
  'kb.keyFmt': 'Private key',
  'kb.keyHolds': 'The private key itself, encrypted with a passphrase or not.',
  'kb.aliasTitle': 'Names for the same thing',
  'kb.alias1': 'The same thing. Both are PKCS#12.',
  'kb.alias2': 'All PKCS#7: a chain, never a key.',
  'kb.alias3': 'Both are a PKCS#10 signing request.',
  'kb.alias4': 'Usually one X.509 certificate. They differ in encoding, not in content.',
  'kb.tellTitle': 'Telling PEM from DER',
  'kb.tellLead': 'The real fork is the encoding, and any of those extensions can be either one.',
  'kb.tellPem': 'is Base64 text. Open it and you see',
  'kb.tellPemAfter': 'at the top.',
  'kb.tellDer': 'is raw binary. Open it and you see nothing you can read.',
  'kb.tellTip':
    'So: open the file in a text editor. Readable means PEM, unreadable means DER. Either way,',
  'kb.tellTipAfter': 'above will convert it.',
};

const ZH = {
  'lang.switch': '切换到英文',
  'lang.button': 'EN',

  'skip.tool': '跳到工具区',
  'nav.tools': '工具',
  'nav.reshape': '转换',
  'nav.check': '检查',
  'nav.create': '生成',

  'head.wordmark': '证书工具箱',
  'head.ephemeral': '不保存任何文件',
  'head.toLight': '切换到浅色主题',
  'head.toDark': '切换到深色主题',

  'foot.temp':
    '上传的文件在临时目录里处理，处理完立即删除。每个下载链接只能用一次，生成一小时后失效。',
  'foot.selfhost': '完全运行在你自己的主机上。',

  'tool.pfx-extract.label': '拆解 PFX',
  'tool.pfx-extract.title': '把 PFX 拆成私钥和证书',
  'tool.pfx-extract.blurb':
    '从 PKCS#12 文件里取回证书和私钥，可以直接放进 nginx 或 Apache。',

  'tool.pfx-create.label': '生成 PFX',
  'tool.pfx-create.title': '用私钥和证书生成 PFX',
  'tool.pfx-create.blurb':
    '把私钥、证书和中间证书打包成一个 PKCS#12 文件，供 Windows、IIS 或 Java keystore 使用。',

  'tool.chain-merge.label': '合并证书链',
  'tool.chain-merge.title': '把证书和中间证书合并',
  'tool.chain-merge.blurb':
    '把证书和它的中间证书合并成一个 fullchain.pem，按服务器证书到根证书排序。不需要私钥，PEM 和 DER 都可以。',

  'tool.convert.label': 'PEM 与 DER',
  'tool.convert.title': '在 PEM 和 DER 之间转换',
  'tool.convert.blurb':
    '同一张证书换一种编码写出来。输入编码按文件内容判断，所以文件名起错了也没关系。',

  'tool.chain.label': '文件里的链',
  'tool.chain.title': '检查文件里的证书链',
  'tool.chain.blurb':
    '看看你手上的证书能不能一路链到自签名根证书，链不上的话告诉你缺哪张中间证书。',

  'tool.url.label': '服务器上的链',
  'tool.url.title': '检查线上服务器提供的证书链',
  'tool.url.blurb':
    '连到正在运行的主机，读回它实际发送的证书链。浏览器里正常、curl 却报错的缺中间证书问题，就是这样抓出来的。',

  'tool.inspect.label': '读取证书',
  'tool.inspect.title': '看看证书里有什么',
  'tool.inspect.blurb': '解码证书并显示全部字段：主题、签发者、有效期、扩展项和备用名称。',

  'tool.csr.label': '新建密钥和 CSR',
  'tool.csr.title': '生成私钥和签名请求',
  'tool.csr.blurb': '生成一个新私钥，以及要提交给 CA 的 CSR，所有主机名都会写进 SAN。',

  'tool.remove-pass.label': '解除私钥口令',
  'tool.remove-pass.title': '去掉私钥上的口令',
  'tool.remove-pass.blurb': '去掉口令，让服务启动时不用有人手动输入。',

  'ui.required': '必填',
  'ui.files': '{n} 个文件',
  'ui.file': '{n} 个文件',
  'ui.dropOne': '把文件拖到这里，或点击选择',
  'ui.dropMany': '把一个或多个文件拖到这里，或点击选择',
  'ui.choose': '选择文件',
  'ui.remove': '移除 {name}',
  'ui.addAnother': '再加一个文件',
  'ui.working': '处理中',
  'ui.need': '请先添加{need}。',
  'ui.failed': '没能完成',
  'ui.produced': '生成的文件',
  'ui.producedAside': '每个链接只能用一次，之后失效',
  'ui.download': '下载',
  'ui.downloaded': '已下载',
  'ui.copy': '复制',
  'ui.copied': '已复制',
  'ui.commands': '等效的 OpenSSL 命令',
  'ui.commandsAside': '自己跑这些命令能得到同样的结果',

  'ui.leaf': '服务器证书',
  'ui.intermediate': '中间证书',
  'ui.root': '根证书（自签名）',
  'ui.signedBy': '由 {issuer} 签发',
  'ui.validRange': '有效期 {from} 至 {to}，{remain}',
  'ui.expiredAgo': '已过期 {span}',
  'ui.notYet': '尚未生效',
  'ui.left': '剩 {span}',
  'ui.days': '{n} 天',
  'ui.months': '{n} 个月',
  'ui.years': '{n} 年',

  'f.cert': '证书',
  'f.chain': '中间证书和根证书',
  'f.key': '私钥',

  'p.extract.file': 'PKCS#12 文件',
  'p.extract.fileHint': '包含证书和私钥的 .pfx 或 .p12 文件。',
  'p.extract.pw': '文件密码',
  'p.extract.pwHint': '文件没有密码就留空。',
  'p.extract.strip':
    '同时解密私钥，这样 nginx 和 Apache 启动时不会要求输入口令。输出为',
  'p.extract.go': '提取',
  'p.extract.need': 'PKCS#12 文件',
  'p.extract.fix':
    '多半是密码不对。老工具生成的文件可能还需要 OpenSSL 的 legacy provider，这个工具会自动重试。',

  'p.create.chainHint':
    '中间证书和根证书可以分开传，也可以传一个包含两者的文件。带上它们，导入后的服务器才能发送完整的链。',
  'p.create.exportPw': '新文件的保护密码',
  'p.create.keyPw': '私钥上的密码',
  'p.create.keyPwHint': '只有上传的私钥被加密时才需要填。',
  'p.create.legacy': '使用旧算法写出，兼容不接受 OpenSSL 3 默认算法的 Windows 和 IIS',
  'p.create.go': '生成文件',
  'p.create.need': '私钥和证书',
  'p.create.fix': '如果 OpenSSL 报告私钥和证书不匹配，说明这两个文件不是一对。',

  'p.merge.certHint': '服务器证书，也就是签给你域名的那一张。PEM 或 DER 都行。',
  'p.merge.chainHint':
    '中间证书和根证书可以分开传，也可以传一个包含两者的文件。顺序无所谓，PEM 和 DER 可以混着来。',
  'p.merge.includeRoot':
    '在输出里保留自签名根证书。Web 服务器一般不带它，因为客户端本来就信任它。',
  'p.merge.go': '合并为 fullchain.pem',
  'p.merge.need': '证书',
  'p.merge.done': '已合并',
  'p.merge.doneSub': '{n} 张证书，已按服务器证书到根证书排序',
  'p.merge.doneSub1': '1 张证书',

  'p.convert.certHint': '编码按文件内容判断，不看扩展名。',
  'p.convert.out': '输出为',
  'p.convert.pem': 'PEM —— Base64 文本，适用于 nginx、Apache 和多数 Unix 工具',
  'p.convert.der': 'DER —— 原始二进制，适用于 Java keystore 和 Windows 工具',
  'p.convert.go': '转换',
  'p.convert.detected': '输入按以下编码读取：',

  'p.check.certHint': '服务器证书。',
  'p.check.chainHint':
    '如果中间证书和根证书是分开给你的，就分开传。证书文件本身已经包含整条链的话可以不填。',
  'p.check.go': '检查证书链',
  'p.check.ok': '证书链完整',
  'p.check.okSub': '每张证书都能链到它的签发者，一直到自签名根证书',
  'p.check.bad': '证书链不完整',
  'p.check.badSub': '至少缺了一个签发者，客户端无法构建到受信任根证书的路径',
  'p.check.unused': '不在链路上：',

  'p.url.host': '主机',
  'p.url.hostHint': '可以是域名、完整 URL，或 host:port。默认端口 443。',
  'p.url.go': '检查服务器',
  'p.url.note': '由这台服务器发起连接，不是你的浏览器。',
  'p.url.need': '主机名',
  'p.url.fix': '检查主机名，以及这台服务器能否通过指定端口访问到它。',
  'p.url.ok': '证书链完整且受信任',
  'p.url.bad': '服务器提供的证书链不可用',
  'p.url.protocol': '协议',
  'p.url.cipher': '加密套件',
  'p.url.verify': '验证结果',

  'p.csr.cn': '通用名称 (CN)',
  'p.csr.cnHint': '证书主要对应的域名。',
  'p.csr.san': '主题备用名称 (SAN)',
  'p.csr.sanHint':
    '用逗号或空格分隔。域名和 IP 地址会自动区分。浏览器不看通用名称，所以每个域名都要写在这里。',
  'p.csr.o': '组织 (O)',
  'p.csr.ou': '部门 (OU)',
  'p.csr.l': '城市 (L)',
  'p.csr.st': '省 / 州 (ST)',
  'p.csr.c': '国家 (C)',
  'p.csr.email': '邮箱',
  'p.csr.key': '密钥类型',
  'p.csr.rsa2048': 'RSA 2048 —— 兼容性最好',
  'p.csr.rsa4096': 'RSA 4096 —— 握手更慢，但留的余量更长',
  'p.csr.ecp256': 'EC P-256 —— 更小更快，适合较新的客户端',
  'p.csr.ecp384': 'EC P-384',
  'p.csr.keyPw': '新私钥的密码',
  'p.csr.keyPwHint': '留空则生成无密码私钥，Web 服务器可以无人值守加载。',
  'p.csr.go': '生成密钥和请求',
  'p.csr.need': '通用名称',
  'p.csr.says': '请求的内容',
  'p.csr.saysAside': '提交给 CA 之前先核对一下',

  'p.pass.key': '加密的私钥',
  'p.pass.current': '当前口令',
  'p.pass.go': '去掉口令',
  'p.pass.note': '输出是没有保护的私钥，请只让 root 可读。',
  'p.pass.need': '私钥和它的口令',
  'p.pass.fix': '口令不对时 OpenSSL 会报 bad decrypt。',

  'p.inspect.certHint': 'PEM 或 DER。用它看清一个没标注的文件到底是什么。',
  'p.inspect.go': '解码',
  'p.inspect.out': '证书内容',
  'p.inspect.fix': '如果 OpenSSL 解析不了，这个文件可能是 PKCS#12 或私钥，而不是证书。',

  'w.noIssuer': '在提供的证书里找不到 "{subject}" 的签发者 —— 可能缺了一张中间证书。',
  'w.leftOut': '未纳入，不属于这条链：{subjects}',
  'w.unordered': '无法自动排序，已按上传顺序保留。',
  'w.missingIntermediate': '缺少中间证书：在提供的文件里找不到 "{subject}" 的签发者 "{issuer}"。',
  'w.noRoot': '证书链没有终止于自签名根证书（未提供根证书）。',
  'w.serverMissingIntermediate':
    '服务器缺少中间证书 —— 不会自行补齐中间证书的客户端将无法验证这个站点。',
  'w.noCaBundle': '系统里没有可用的 CA 根证书库，无法确认信任，只做了结构分析。',
  'w.badOrder': '服务器发送的证书没有按服务器证书到根证书的顺序排列（或者中间断了一环）。',

  'kb.title': '哪个文件是什么',
  'kb.sub': '格式、扩展名，以及各自装了什么',
  'kb.intro':
    '所有证书都遵循 X.509 标准。围绕它的容器格式由 RSA Labs 的 PKCS 系列标准定义，实际会碰到的有三种：#7 装证书链，#10 装签名请求，#12 把证书和私钥打包在一起。坑在于，文件扩展名几乎说明不了里面到底是什么格式。',
  'kb.headFormat': '格式',
  'kb.headExt': '实际见到的扩展名',
  'kb.headEnc': '编码',
  'kb.headKey': '含私钥',
  'kb.headHolds': '里面是什么',
  'kb.encBinary': '二进制',
  'kb.encBase64': 'Base64 文本',
  'kb.encEither': 'DER 或 PEM',
  'kb.encPem': 'PEM，有时是 DER',
  'kb.no': '否',
  'kb.yesPw': '是，有密码保护',
  'kb.isKey': '它本身就是私钥',
  'kb.derFmt': 'X.509 证书，DER',
  'kb.derHolds': '一张证书，以原始字节存储。',
  'kb.pemFmt': 'X.509 证书，PEM',
  'kb.pemHolds': '一张或多张 Base64 证书，每张都用 -----BEGIN CERTIFICATE----- 包起来。',
  'kb.p12Fmt': 'PKCS#12',
  'kb.p12Holds': '证书、证书链和私钥装在一个文件里。身份要在系统之间搬家，靠的就是它。',
  'kb.p7Fmt': 'PKCS#7',
  'kb.p7Holds': '只有一串证书，没有私钥。.p7r 是 CA 的回复。',
  'kb.csrFmt': 'PKCS#10，也就是 CSR',
  'kb.csrHolds': '签名请求：你交给 CA、让它签发证书的东西。',
  'kb.keyFmt': '私钥',
  'kb.keyHolds': '私钥本身，可能带口令加密，也可能没有。',
  'kb.aliasTitle': '同一样东西的不同叫法',
  'kb.alias1': '完全一样，都是 PKCS#12。',
  'kb.alias2': '都是 PKCS#7：一串证书，绝不含私钥。',
  'kb.alias3': '都是 PKCS#10 签名请求。',
  'kb.alias4': '通常都是一张 X.509 证书。区别在编码，不在内容。',
  'kb.tellTitle': '怎么区分 PEM 和 DER',
  'kb.tellLead': '真正的分水岭是编码，而上面那些扩展名两种都可能。',
  'kb.tellPem': '是 Base64 文本。打开能看到开头是',
  'kb.tellPemAfter': '。',
  'kb.tellDer': '是原始二进制。打开全是看不懂的东西。',
  'kb.tellTip': '所以：用文本编辑器打开。能读就是 PEM，不能读就是 DER。两种情况上面的',
  'kb.tellTipAfter': '都能帮你转。',
};

const DICTS = { en: EN, zh: ZH };

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function translate(lang, key, vars) {
  const text = DICTS[lang]?.[key] ?? EN[key];
  return text === undefined ? key : interpolate(text, vars);
}

const LangContext = createContext(null);

function initialLang() {
  try {
    const saved = localStorage.getItem('ct-lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* storage may be blocked; fall through to the browser's preference */
  }
  return typeof navigator !== 'undefined' && /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = translate(lang, 'head.wordmark');
    try {
      localStorage.setItem('ct-lang', lang);
    } catch {
      /* storage may be blocked; the choice still applies for this visit */
    }
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggle: () => setLang((l) => (l === 'zh' ? 'en' : 'zh')),
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useI18n must be used inside <LangProvider>');
  return ctx;
}

export function useT() {
  return useI18n().t;
}

/**
 * Render a message the server sent. It arrives as { code, params } so it can
 * be shown in either language, with the server's English text as the fallback
 * for anything this build does not know a key for.
 */
export function useServerMessage() {
  const { lang } = useI18n();
  return useCallback(
    (m) => {
      if (!m) return '';
      if (typeof m === 'string') return m;
      const text = DICTS[lang]?.[m.code];
      return text ? interpolate(text, m.params) : m.text || m.code;
    },
    [lang]
  );
}
