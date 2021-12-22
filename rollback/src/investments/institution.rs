use std::collections::BTreeMap;

use crate::investments::account::{Account, AccountId};
use crate::investments::total::Total;
use url::Url;

/// An iterable map of all institutions
pub type Institutions = BTreeMap<String, InstitutionAccounts>;

impl Total for Institutions {
    fn total(&self) -> u64 {
        self.iter()
            .fold(0, |acc, (_, inst_accs)| acc + inst_accs.total())
    }
}

/// All accounts, stored by `AccountId`, at a particular institution
pub struct InstitutionAccounts {
    institution: Institution,
    accounts: BTreeMap<AccountId, Account>,
}

impl InstitutionAccounts {
    pub fn new(institution: Institution) -> Self {
        Self {
            institution,
            accounts: BTreeMap::new(),
        }
    }

    pub fn institution(&self) -> &Institution {
        &self.institution
    }

    pub fn accounts(&self) -> &BTreeMap<AccountId, Account> {
        &self.accounts
    }

    pub fn accounts_mut(&mut self) -> &mut BTreeMap<AccountId, Account> {
        &mut self.accounts
    }
}

impl Total for InstitutionAccounts {
    fn total(&self) -> u64 {
        self.accounts
            .iter()
            .fold(0, |acc, (_, account)| acc + account.total())
    }
}

/// An invesmtment institution
pub struct Institution {
    name: String,
    url: Url,
}

impl Institution {
    pub fn new(name: String, url: Url) -> Self {
        Self { name, url }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn url(&self) -> &Url {
        &self.url
    }
}
