const format = require('string-template');
const soap = require('soap');
const {WebhookClient} = require('dialogflow-fulfillment');
const moment = require('moment');

module.exports = function (context, req) {

    context.log(req.body);

    context.bindings.table = {
        "partitionKey": "TestUser",
        "rowKey": req.body.session,
        "Name": req.body.queryResult.action
    }

    var agent = new WebhookClient({ request: req, response: context.res });
    global.client = null;

    var url = './GetFXRate.xml';
    soap.createClient(url, function(err, g_client) {
      if(!g_client) {
        return console.log(err);
      }
      client = g_client;
      client.setEndpoint('https://citmobile.stanbicbank.com.gh/citwebservice/GetFXRate')
      client.setSecurity(new soap.ClientSSLSecurityPFX(
          './citmobile.stanbicbank.com.gh-Jeff.pfx',
          'Fr33W!lly',
          { rejectUnauthorized: false }
      ));
      let intents = new Map();
      intents.set('currency.convert', getFXRate);
      /*intents.set('account.balance.check', fallback);
      intents.set('account.spending.check', fallback);
      intents.set('transfer.money', fallback);*/
      agent.handleRequest(intents);
    });

    function getFXRate(agent) {  
      return fx(agent)
        .then ( amount => agent.add(amount) )
        .catch( error => agent.add(error) )
    }
    
    function fallback(agent) {
      agent.add(`I'm sorry, api not hooked up yet.`);
    }

    var fx = (agent) => new Promise((resolve, reject) => {
      var fixed = agent.parameters['currency-from'],
          variable = agent.parameters['currency-to'],
          amount = agent.parameters.amount || 1;
      client.GetFXRate({
        fixedCurrency: fixed,
        varCurrency: variable
      }, function(err, result, rawResponse, soapHeader, rawRequest){
          if(err) return resolve (`There is no data available for convertion on ${variable} and ${fixed}`);
          var arr = result.GetFXRateResult.split("=");
          if(arr && arr.length > 1) {
            var date = arr[0].match(/\d+/g);
            date = moment(`${date[2]}-${date[0]}-${date[1]}`).format("Do MMMM YYYY");
            return resolve (
              format(req.body.queryResult.fulfillmentText, {
                date, 
                amount: (arr[1] * amount).toFixed(2)
              })
            );
          }
          return reverse_fx(variable, fixed, amount)
            .then ( amount => resolve(amount) )
            .catch( error => resolve(error) )
      })
    });

    var reverse_fx = (fixed, variable, amount) => new Promise((resolve, reject) => {
      client.GetFXRate({
        fixedCurrency: fixed,
        varCurrency: variable
      }, function(err, result, rawResponse, soapHeader, rawRequest){
          if(err) return resolve (`There is no data available for convertion on ${variable} and ${fixed}`);
          var arr = result.GetFXRateResult.split("=");
          if(arr && arr.length > 1) {
            var date = arr[0].match(/\d+/g);
            date = moment(`${date[2]}-${date[0]}-${date[1]}`).format("Do MMMM YYYY");
            resolve (
              format(req.body.queryResult.fulfillmentText, {
                date, 
                amount: (arr[1] * amount).toFixed(2)
              })
            );
          }
          else
            resolve (`There is no data available for convertion on ${variable} and ${fixed}`);
      })
    });

    context.log('Webhook was triggered!');

}
