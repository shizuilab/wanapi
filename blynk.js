var Blynk = require('blynk-library');
var config = require('./config');

var AUTH = config.AUTH;

var blynk = new Blynk.Blynk(AUTH);
var workerid = '1';
var temp = 35.0;

var v0 = new blynk.VirtualPin(0); //ID
var v1 = new blynk.VirtualPin(1); //TEMP
var v2 = new blynk.VirtualPin(2); //SEND button
var v3 = new blynk.VirtualPin(3); //LCD line0
var v4 = new blynk.VirtualPin(4); //LCD line1
var v5 = new blynk.VirtualPin(5); //graph value1
var v6 = new blynk.VirtualPin(6); //graph value2
var v7 = new blynk.VirtualPin(7); //graph value3
var v8 = new blynk.VirtualPin(8); //graph value4
var v9 = new blynk.VirtualPin(9); //picture frame

// NIS1のMainnetを使用
// 　　第1引数はMainnet用のデフォルトのノード
// 　　第2引数はデフォルトのポート(7890)
var nem = require("nem-sdk").default // NIS1用SDKを読み込み
const endpoint = nem.model.objects.create('endpoint')
        (nem.model.nodes.defaultMainnet, nem.model.nodes.defaultPort);

v0.on('write', function(param) {
  workerid = param[0];
  console.log('ID:', workerid);
});

v1.on('write', function(param) {
  temp = param[0];
  console.log('TEMP:', temp);
  switch (workerid){
    case '1':
      v5.write(parseFloat(temp));
      console.log('Graph Record: worker0' + workerid + 'temp' + temp); 
      break;
    case '2':
      v6.write(parseFloat(temp));
      console.log('Graph Record: worker0' + workerid + 'temp' + temp); 
      break;
    case '3':
      v7.write(parseFloat(temp));
      console.log('Graph Record: worker0' + workerid + 'temp' + temp); 
      break;
    case '4':
      v8.write(parseFloat(temp));
      console.log('Graph Record: worker0' + workerid + 'temp' + temp); 
      break;
    default:
      break;
  }
});

v2.on('write', function(param) {
  v4.write('worker0' + workerid + ':Sending');
  transaction('worker0' + workerid + 'temp' + temp);
});

v3.on('read', function() {
  v3.write('System Message:');
});

v4.on('read', function() {
  v4.write('worker0' + workerid + 'temp' + temp);
});

// ここからトランザクション処理をする関数
async function transaction(msg) {

  // 送金先のアドレス（config/wanapi-nis1.jsから取得）
  const toAddress = config.ADDRESS;
  // 送金額（0 XEM でも可。手数料は取られる模様）
  const sendAmount = 0;
  // 送金の際に指定するメッセージ（configの場所＋バーコード読み取り値）
  const sendMsg = config.WORKPLACE + ":" + msg;
  // 送金元ウォレットのパスワード（空欄でも可）
  const password = '';
  // configより送金元の秘密鍵を取得
  const privateKey = config.PRIVATEKEY;
  // パスワードと秘密鍵をセットにしたオブジェクト
  const common = nem.model.objects.create('common')(password, privateKey);
  // configよりモザイクのネームスペースを取得
  const yourMosaicNamespace = config.NAMESPACE;
  // configよりモザイクのモザイク名を取得
  const yourMosaicName = config.MOSAIC;

  // Transactionの作成
  let transferTransaction1 = nem.model.objects.create('transferTransaction')(toAddress, sendAmount, sendMsg);
  // XEM mosaicを付与する
  const xemMozaic = nem.model.objects.create('mosaicAttachment')('nem', 'xem', sendAmount * 1000000);
  transferTransaction1.mosaics.push(xemMozaic);
  // XEM以外のmosaicを付与する
  const yourMosaic = nem.model.objects.create('mosaicAttachment')(yourMosaicNamespace, yourMosaicName, 1);
  transferTransaction1.mosaics.push(yourMosaic);
  // 手数料を計算するためにモザイクの定義を取得する
  let mosaicDefinitionMetaDataPair = nem.model.objects.get('mosaicDefinitionMetaDataPair');
  nem.com.requests.namespace.mosaicDefinitions(endpoint, yourMosaic.mosaicId.namespaceId).then(res => {
      // モザイク定義を取得してモザイク定義オブジェクトへ格納する
      const neededDefinition = nem.utils.helpers.searchMosaicDefinitionArray(res.data, [yourMosaicName]);
      // モザイク定義オブジェクトで使用するため、モザイクの名前を取得
      const fullMosaicName  = nem.utils.format.mosaicIdToName(yourMosaic.mosaicId);
      // モザイクの存在確認
      if (undefined === neededDefinition[fullMosaicName]) {
          return console.log('Mosaic not found !');
      }
      // モザイクの定義をモザイク定義オブジェクトへ追加する
      mosaicDefinitionMetaDataPair[fullMosaicName] = {};
      mosaicDefinitionMetaDataPair[fullMosaicName].mosaicDefinition = neededDefinition[fullMosaicName];
      nem.com.requests.mosaic.supply(endpoint, fullMosaicName).then(supplyRes => {
          // 供給量をmosaicDefinitionMetaDataPairに設定する。
          mosaicDefinitionMetaDataPair['nem:xem'].supply = 8999999999;
          mosaicDefinitionMetaDataPair[fullMosaicName].supply = 9000000000;
          // 署名をしてTransactionを送信する準備を完了する
          const transactionEntity = nem.model.transactions.prepare('mosaicTransferTransaction')
　　　　　　　(common, transferTransaction1, mosaicDefinitionMetaDataPair, nem.model.network.data.mainnet.id);
          // Transactionをブロードキャストしてネットワークへ公開する
          nem.model.transactions.send(common, transactionEntity, endpoint).then(sendRes => {
              console.log('sendRes:', sendRes); //結果を表示（任意のタイミングで返ってくる）
              v4.write(sendRes["message"]); //結果のSUCCESSなどを表示
              v2.write(0); //ボタンをもとに戻す
          }).catch(sendErr => {
              console.log('sendError:', sendErr);
            });
      }).catch(supplyErr => {
          console.log('supplyError:', supplyErr);
        });
  }).catch(err => {
      console.log('mosaicDefinitionsError:', err);
    });
}

