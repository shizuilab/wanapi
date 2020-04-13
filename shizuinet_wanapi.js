#!/usr/bin/node
//ShizuiNet WanaPi NIS1 version
//Invented and Programmed by K.Tezuka & K.Mochizuki at Gifu University
//Supported by Tech Bureou $ 4D Pocket.
//Distributed from 20200409
//非同期処理についてはこちらを参考にした：https://qiita.com/KuwaK/items/6455e34c245992a73aa1

console.log("WanaPi!起動中...");

const config = require('./config'); //公開したくない環境変数はconfigディレクトリへ

const { Client } = require('node-osc');
const client = new Client('127.0.0.1', 5005);

var gpio = require('rpi-gpio');
const LED_PIN = 7; // GPIO04

const prompts = require("prompts") // バーコード読み取り用ライブラリの読み込み

//バックライトオンの時間を制御するスリープ関数
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

//AQM0802 バックライトをオン（msの間)
async function backlight(ms){
    gpio.setup(LED_PIN, gpio.DIR_OUT, () => {
        gpio.write(LED_PIN, true);
    });
    await sleep(ms);
    gpio.setup(LED_PIN, gpio.DIR_OUT, () => {
        gpio.write(LED_PIN, false);
    });
};

// NIS1のMainnetを使用
// 　　第1引数はMainnet用のデフォルトのノード
// 　　第2引数はデフォルトのポート(7890)
var nem = require("nem-sdk").default // NIS1用SDKを読み込み
const endpoint = nem.model.objects.create('endpoint')
        (nem.model.nodes.defaultMainnet, nem.model.nodes.defaultPort);

// ここからトランザクション処理をする関数
async function transaction(msg) {

  // 送金先のアドレス（config/wanapi-nis1.jsから取得）
  const toAddress = config.ADDRESS;
  // 送金額（0 XEM でも可。手数料は取られる模様）
  const sendAmount = 0;
  // 送金の際に指定するメッセージ（configの場所＋バーコード読み取り値）
  const sendMsg = config.PLACE + ":" + msg;
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
              client.send('/change_msg', sendRes["message"] + " " + msg, () => {}); //結果のSUCCESSなどを表示
　　　　　　　backlight(3000); //結果が出たらバックライトオン３秒
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

main()

function main(){
  client.send('/change_msg', 'WANAPI!  =READY=', () => {});
  backlight(30000); //立ち上がり後30秒間はLEDオン

  //ループ処理
  (async ()=> {
    while (true) {
      console.log("Ready")
      let questions = {
          type: "text", // インプットタイプ
          name: "myValue", // 変数名
          message: "バーコードを読み取ってください："
      };

      ///// promptsを起動して入力待ち/////
      let response =  await prompts(questions);
      console.log(response.myValue.length); //文字数カウント7文字から16文字まで受け入れる
      if (response.myValue.length < 7 || response.myValue.length > 16){
          client.send('/change_msg', '*ERROR!*' + response.myValue, () => {});
          console.log("入力値の文字数が不正です");
      }
      else {
          client.send('/change_msg', response.myValue + '..........', () => {}); //入力文字列を表示し残りを.で埋める
          await transaction(response.myValue);
      }
      await backlight(3000);
    }
  }).call()
}
