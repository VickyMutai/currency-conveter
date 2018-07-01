class CurrencyConverter {
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
           
        }).catch( error => {
            console.log('It looks like your are offline or have a bad network: '+ error);
        });
    }
}