class CurrencyConverter {

    constructor() {
        this.registerServiceWorker();
        this.dbPromise = this.openDatabase();
        this.getAllCurrencies();
    }
    // register service worker
    registerServiceWorker() {
        if (!navigator.serviceWorker) return;
        navigator.serviceWorker.register('sw.js').then(reg => {});
    } // close registerServiceWorker method
    // create index db database
    openDatabase() {
        if (!('indexedDB' in window)) {
            console.log('This browser doesn\'t support IndexedDB');
            return Promise.resolve();
          }
        
          return idb.open('currencyConverter', 4, upgradeDb => {
                switch(upgradeDb.oldVersion) {
                    case 0:
                        upgradeDb.createObjectStore('currencies');
                    case 2:
                        upgradeDb.transaction.objectStore('currencies').createIndex('id', 'id', {unique: true});
                    case 3:
                        upgradeDb.createObjectStore('currencyRates', {keyPath: 'query'});
                        upgradeDb.transaction.objectStore('currencyRates').createIndex('query', 'query', {unique: true});
                }
         });
    }
    // add data to database
    addCurrenciesToCache(currencies) {
        this.dbPromise.then(db => {
            if (!db) return;
            
            let tx = db.transaction('currencies', 'readwrite'); // create a transaction 
            let store = tx.objectStore('currencies'); // access currencies the object store
            // loop through the currencies object and add them to the currencies object store
            for (const currency of currencies) {
                store.put(currency, currency.id);
            }
           // return tx.complete;

            // limit store to 160 items
            store.index('id').openCursor(null, "prev").then(cursor => {
                return cursor.advance(160);
            }).then(function deleteRest(cursor) {
                if (!cursor) return;
                cursor.delete();
                return cursor.continue().then(deleteRest);
            });
        }).then(() => {
            console.log('list of currencies added to cache (db)');
         }).catch(error => console.log('Something went wrong: '+ error));
    }

    addCurrencyRateToCache(rate, fromCurrency, toCurrency) {
        this.dbPromise.then(db => {
            if (!db) return;
            
            let tx = db.transaction('currencyRates', 'readwrite'); // create a transaction 
            let store = tx.objectStore('currencyRates'); // access currency rate object stores

            let query = `${fromCurrency}_${toCurrency}`;
            // add the new entry or replace old entry with new one
            store.put({ query, rate });

            // limit store to 50 items
           store.index('query').openCursor(null, "prev").then(cursor => {
                return cursor.advance(50);
            }).then(function deleteRest(cursor){
                if (!cursor) return;
                cursor.delete();
                return cursor.continue().then(deleteRest);
            });
        }).then(() => {
            console.log('Currency rate for ' + fromCurrency + ' and ' + toCurrency + ' added to cache');
         }).catch(error => console.log('Something went wrong: '+ error));
    }
   
    getCurrencyRateFromCache(fromCurrency, toCurrency) {
       return this.dbPromise.then(db => {
            if (!db) return;

            const query = `${fromCurrency}_${toCurrency}`;
            let tx = db.transaction('currencyRates', 'readwrite'); // create a transaction 
            let store = tx.objectStore('currencyRates'); // access currency rate object stores

           return store.index('query').get(query);
        }).then( RateObj => { 
                   const currencyRate  = RateObj.rate;
                    return {currencyRate, appStatus: 'offline'}; // return the currency rate value
         }).catch(error => {
             console.log('Sorry! No rate was found in the cache:');
             this.postToHTMLPage('','No rate was found in the cache');
             return error;
        });
    }
   
    showCachedCurrencies() {
        return this.dbPromise.then( db => {

            if (!db) return;
        
            let index = db.transaction('currencies')
              .objectStore('currencies').index('id');
        
            return index.getAll().then( currencies => {
                console.log('Currencies fetched from cache');

                let selectFields = document.querySelectorAll('select.currency');

                //loop through the returned currencies from the cache
                for(const currency of currencies){
                    let option = this.createElement('option');
                    if(currency.hasOwnProperty('currencySymbol')) option.text = `${currency.currencyName} (${currency.currencySymbol})`;
                    else option.text = `${currency.currencyName} (${currency.id})`;
                    option.value = currency.id;

                    //add currency to the select field
                    this.appendElement(selectFields,option);
                }
                this.postToHTMLPage('msg', 'you are offline');
            });
          });
    }

    getAllCurrencies() {
        fetch('https://free.currencyconverterapi.com/api/v5/currencies').then(response => {
            return response.json();
        }).then(response => {
            let currencies = Object.values(response.results);
            let selectFields = document.querySelectorAll('select.currency');

            //loop through the returned currencies from the api
            for(const currency of Object.values(currencies)){
                let option = this.createElement('option');
                if(currency.hasOwnProperty('currencySymbol')) option.text = `${currency.currencyName} (${currency.currencySymbol})`;
                else option.text = `${currency.currencyName} (${currency.id})`;
                 option.value = currency.id;

                 //add currency to the select field
                 this.appendElement(selectFields,option);
            }
            // add the currencies to cache
            this.addCurrenciesToCache(currencies); // call to the method that stores returned currencies to cache.
            this.postToHTMLPage('msg','you are online');
           
        }).catch( error => {
            console.log('It looks like your are offline or have a bad network: '+ error);
            this.showCachedCurrencies(); // get currencies from cache since user is offline.
        });
    }

    postToHTMLPage(wht, msg, outputResult = {}) {
       if(wht === 'result') { // show result after conversion
            document.getElementById('result').innerHTML = `${outputResult.toCurrency} ${outputResult.result.toFixed(2)}`;
        }
        else if(wht = 'offlineFailure') {
            document.getElementById('result').innerHTML = '0.00';
        }

        if(msg !== ''){
            // show user that he is online or offline.
            document.getElementById('alert').innerHTML = msg;
        }
        return;
    }

    getConversionRate(fromCurrency, toCurrency) {
        fromCurrency = encodeURIComponent(fromCurrency);
        toCurrency = encodeURIComponent(toCurrency);
        let query = fromCurrency + '_' + toCurrency;

        return fetch('https://free.currencyconverterapi.com/api/v5/convert?q='+ query + '&compact=ultra').then(response => {
            return response.json();
        }).then(response => {
            const currencyRate = response[Object.keys(response)]; 
            return  {currencyRate, appStatus: 'online'};
        }).catch(error => {

            const currencyRate = this.getCurrencyRateFromCache(fromCurrency, toCurrency);
            return  currencyRate;
        });
    }

    createElement(element) {
        return document.createElement(element);
        return;
    }

   appendElement(parentElement, element)
   {
       let element2 = element.cloneNode(true); 
       parentElement[0].appendChild(element);
       parentElement[1].appendChild(element2);
       return;
   }
}



(function(){
    const converter = new CurrencyConverter(); 
    document.getElementById('btnConvert').addEventListener('click', () =>{
        let msg = '';
         converter.postToHTMLPage('msg', 'conversion in progress, please wait...');
        // get form fields
        const amount = document.getElementById('amount').value;
        const fromCurrency = document.getElementById('from_cur').value;
        const toCurrency = document.getElementById('to_cur').value;
    
        // validations
        if(amount === '' || amount === 0 || isNaN(amount)) msg = 'Amount must be a number greater than 0.';
        else if(fromCurrency ==='') msg = 'Please specify the currency to convert from.';
        else if(toCurrency ==='') msg = 'Please specify the currency to convert to.';
        else if (fromCurrency === toCurrency) msg = 'Please choose a different currency to convert to.';
        else {
            // call the method that calls currency api to get conversion rate
            converter.getConversionRate(fromCurrency,toCurrency).then( response =>{ 
                 const rate = response.currencyRate;
                 const appStatus = response.appStatus; // get state of user when currency rate was obtained
                if(rate !== undefined)
                {
                    const result = amount * rate; // performs currency convertion
                
                    // set conversion rate msg.
                    msg = "Exchange rate : " + rate;
                    converter.postToHTMLPage('result', msg, {result, toCurrency}); // call to method that handles dom communication.
                    // add conversion rate to cache if currency rate was obtained from api
                    if(appStatus ==='online')  converter.addCurrencyRateToCache(rate, fromCurrency, toCurrency); 
                }
                else converter.postToHTMLPage('offlineFailure', 'You are offline. Go online to fully experience the functionalities of this app.');
            }).catch( error => {
                console.log('No rate was found in the cache: ');
                converter.postToHTMLPage('', error);
            });
        }
    
        converter.postToHTMLPage('msg', msg); // call to method that handles dom communication.  
    });


})();