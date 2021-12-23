use std::collections::BTreeMap;

use crate::investment::Investment;
use crate::ticker::TickerSymbol;
use crate::total::Total;

/// An account with investments stored by `TickerSymbol`
#[derive(Clone, Hash, Eq, PartialEq)]
pub struct Account {
    id: AccountId,
    kind: AccountKind,
    investments: BTreeMap<TickerSymbol, Investment>,
}

impl Account {
    pub fn new(id: String, kind: AccountKind) -> Self {
        Self {
            id,
            kind,
            investments: BTreeMap::new(),
        }
    }

    pub fn id(&self) -> &AccountId {
        &self.id
    }

    pub fn kind(&self) -> &AccountKind {
        &self.kind
    }

    pub fn update_kind(&mut self, kind: AccountKind) {
        self.kind = kind;
    }

    pub fn add_fund(&mut self, ticker_symbol: TickerSymbol) {
        let investment = Investment::new(ticker_symbol.clone(), 0);
        self.investments.insert(ticker_symbol, investment);
    }

    pub fn remove_fund(&mut self, ticker_symbol: TickerSymbol) -> Option<Investment> {
        self.investments.remove(&ticker_symbol)
    }
}

impl Total for Account {
    fn total(&self) -> u64 {
        self.investments
            .iter()
            .fold(0, |acc, (_, inv)| acc + inv.total())
    }
}

pub type AccountId = String;

#[derive(Clone, Hash, Eq, PartialEq)]
pub enum AccountKind {
    Brokerage,
    IRA(IraKind),
    DefinedContribution(DcKind),
}

#[derive(Clone, Hash, Eq, PartialEq)]
pub enum IraKind {
    Traditional,
    Roth,
    SEP,
    SIMPLE,
    Conduit,
}

#[derive(Clone, Hash, Eq, PartialEq)]
pub enum DcKind {
    Dc401k(BucketKind),
    Dc403b(BucketKind),
    Dc457b(BucketKind),
    ProfitSharing,
    MoneyPurchase,
    DefinedBenefit,
}

#[derive(Clone, Hash, Eq, PartialEq)]
pub enum BucketKind {
    PreTax,
    Roth,
    AfterTax,
}
