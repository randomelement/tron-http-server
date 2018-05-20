const RpcClient = require("./rpcclient");
const tools = require("tron-http-tools");

const {WithdrawBalanceContract, WitnessUpdateContract, TransferContract, TransferAssetContract, VoteWitnessContract, AssetIssueContract, FreezeBalanceContract, ParticipateAssetIssueContract, AccountUpdateContract} = require("@tronprotocol/wallet-api/src/protocol/core/Contract_pb");
const {Transaction} = require("@tronprotocol/wallet-api/src/protocol/core/Tron_pb");

const {getBase58CheckAddress}= require('@tronprotocol/wallet-api/src/utils/crypto');
const ContractType = Transaction.Contract.ContractType;


module.exports = class{

    constructor(config, db){
        this.db = db;
        this.rpc = new RpcClient(config);

        this.main();
    }

    async getRpcBlockInfoByNum(id){
        let block = await this.rpc.getBlockByNum(id);
        let blockHeader = block.getBlockHeader().toObject();
        let blockId = blockHeader.rawData.number;
        let blockHash = tools.utils.uint8ToBase64(tools.blocks.getBlockHash(block));
        let blockParentHash = blockHeader.rawData.parenthash;

        return {
            block,
            blockHeader,
            blockId,
            blockHash,
            blockParentHash
        };
    }

    async loadBlocksBetween(start, end){
        for(var i = start;i<=end;i++){
            console.log(`Loading block ${i}`);

            let blockLoadStart = Date.now();
            let block = await this.rpc.getBlockByNum(i);

            let blockHeader = block.getBlockHeader().toObject();
            let blockId = blockHeader.rawData.number;
            let blockHash = tools.utils.uint8ToBase64(tools.blocks.getBlockHash(block));
            let blockParentHash = blockHeader.rawData.parenthash;
            let transactionsList = block.getTransactionsList();

            let newBlock = {
                block_id : i,
                block_hash : blockHash,
                block_parent_hash : blockParentHash,
                num_transactions : 0
            };

            let newContracts = [];

            if(transactionsList.length > 0){
                for(var j = 0;j<transactionsList.length;j++){
                    let transaction = transactionsList[j].toObject();

                    let contracts = transactionsList[j].getRawData().getContractList();

                    for (var c = 0; c < contracts.length; c++) {
                        var contract = contracts[c];
                        let type = contract.getType();
                        let parameter = contract.getParameter();
                        let value = parameter.getValue();
                        let desc = parameter.getTypeUrl().toString().split(".");
                        desc = desc[desc.length - 1];

                        /*
                          ACCOUNTCREATECONTRACT: 0,
                          TRANSFERCONTRACT: 1, <------IMPLEMENTED
                          TRANSFERASSETCONTRACT: 2, <-------- IMPLEMENTED
                          VOTEASSETCONTRACT: 3,
                          VOTEWITNESSCONTRACT: 4, <------IMPLEMENTED
                          WITNESSCREATECONTRACT: 5, <------IMPLEMENTED
                          ASSETISSUECONTRACT: 6, <------IMPLEMENTED
                          DEPLOYCONTRACT: 7,
                          WITNESSUPDATECONTRACT: 8, <-------- IMPLEMENTED
                          PARTICIPATEASSETISSUECONTRACT: 9, <-------- IMPLEMENTED
                          ACCOUNTUPDATECONTRACT: 10, <-------- IMPLEMENTED
                          FREEZEBALANCECONTRACT: 11, <------IMPLEMENTED
                          UNFREEZEBALANCECONTRACT: 12,
                          WITHDRAWBALANCECONTRACT: 13,
                          CUSTOMCONTRACT: 20
                         */

                        switch (type) {
                            case ContractType.TRANSFERCONTRACT://1
                            {
                                let contr = TransferContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let toAddress = getBase58CheckAddress(Array.from(contr.getToAddress()));
                                let amount = contr.getAmount();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    to_address : toAddress,
                                    amount : amount
                                });
                            }
                                break;
                            case ContractType.TRANSFERASSETCONTRACT://2
                            {
                                let contr = TransferAssetContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let toAddress = getBase58CheckAddress(Array.from(contr.getToAddress()));
                                let assetName = String.fromCharCode.apply(null, contr.getAssetName());
                                let amount = contr.getAmount();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    to_address : toAddress,
                                    asset_name : assetName,
                                    amount : amount
                                });
                            }
                                break;
                            case ContractType.VOTEWITNESSCONTRACT://4
                            {
                                let contr = VoteWitnessContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress
                                });
                            }
                                break;
                            case ContractType.WITNESSCREATECONTRACT://5
                            {
                                let contr = VoteWitnessContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress
                                });
                            }
                                break;
                            case ContractType.ASSETISSUECONTRACT: //6
                            {
                                let contr = AssetIssueContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                let name = String.fromCharCode.apply(null, contr.getName());
                                let description = String.fromCharCode.apply(null, contr.getDescription());
                                let url = String.fromCharCode.apply(null, contr.getUrl());

                                await this.db.insertAsset({
                                    owner_address : ownerAddress,
                                    name : name,
                                    total_supply : contr.getTotalSupply(),
                                    trx_num : contr.getTrxNum(),
                                    num : contr.getNum(),
                                    start_time : contr.getStartTime(),
                                    end_time : contr.getEndTime(),
                                    decay_ratio : contr.getDecayRatio(),
                                    vote_score : contr.getVoteScore(),
                                    description : description,
                                    url : url,
                                    block_id : i
                                });

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    name : name
                                });
                            }
                                break;
                            case ContractType.WITNESSUPDATECONTRACT: {
                                let contr = WitnessUpdateContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress
                                });
                            }
                                break;
                            case ContractType.PARTICIPATEASSETISSUECONTRACT: //9
                            {
                                let contr = ParticipateAssetIssueContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let toAddress = getBase58CheckAddress(Array.from(contr.getToAddress()));
                                let assetName = String.fromCharCode.apply(null, contr.getAssetName());
                                let amount = contr.getAmount();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    to_address : toAddress,
                                    asset_name : assetName,
                                    amount : amount
                                });
                            }
                                break;
                            case ContractType.ACCOUNTUPDATECONTRACT: {
                                let contr = AccountUpdateContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let accountName = String.fromCharCode.apply(null, contr.getAccountName());

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    account_name : accountName
                                });
                            }
                                break;
                            case ContractType.FREEZEBALANCECONTRACT://11
                            {
                                let contr = FreezeBalanceContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let frozenBalance = contr.getFrozenBalance();
                                let frozenDuration = contr.getFrozenDuration();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    frozen_balance : frozenBalance,
                                    frozen_duration : frozenDuration
                                });
                            }
                                break;

                            case ContractType.WITHDRAWBALANCECONTRACT:
                            {
                                let contr = WithdrawBalanceContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress
                                });
                            }
                            break;
                            default:
                                throw `contract type ${type} not implemented`;
                        }
                    }
                }
            }

            if(newContracts.length > 0){
                newBlock.num_contracts = newContracts.length;
                await this.db.insertContracts(newContracts);
            }
            await this.db.insertBlock(newBlock);
            console.log(`inserting block took ${Date.now() - blockLoadStart}`);
        }
    }

    async findFirstNonForkedBlock(min, max){
        //this is going 10 back at a time, because usually forks are only short.
        //might want to replace with binary search at some point

        let current = max;
        let steps = 10;
        while(current > 0){
            let rpcBlock = await this.getRpcBlockInfoByNum(current);
            let dbBlock = await this.db.getBlockByNum(current);

            if(dbBlock.block_hash == rpcBlock.blockHash ||
                dbBlock.block_parent_hash == rpcBlock.blockParentHash){
                //non-forked block detected
                return current;
            }else{
                console.log('forked block: ' + current);
                if(current == 1){
                    //giving up
                    current=0;
                }else{
                    current -= steps;
                    if(current < 1)
                        current = 1;
                    steps++;
                }
            }
        }

        throw 'this should never happen because complete forks should be detected before.';
    }

    async cleanForkedDbBlocks(lastDbBlock){
        let rpcBlock = await this.getRpcBlockInfoByNum(lastDbBlock.block_id);
        if(lastDbBlock.block_hash == rpcBlock.blockHash &&
            lastDbBlock.block_parent_hash == rpcBlock.blockParentHash &&
            lastDbBlock.block_id == rpcBlock.blockId){
            return lastDbBlock.block_id;
        }

        let rpcBlockZero = await this.getRpcBlockInfoByNum(0);
        let dbBlockZero = await this.db.getBlockByNum(0);

        if(dbBlockZero.block_hash != rpcBlockZero.blockHash ||
            dbBlockZero.block_parent_hash != rpcBlockZero.blockParentHash){

            console.log('block zero:');
            console.log(rpcBlockZero);
            console.log('current:');
            console.log(lastDbBlock);

            console.log(`fork detected! complete reset. starting from zero`);
            this.db.deleteBlocksStartingAt(0);
            return -1;
        }


        let firstNonForkedBlock = await this.findFirstNonForkedBlock(0, lastDbBlock.block_id);
        await this.db.deleteBlocksStartingAt(firstNonForkedBlock);
        console.log(`cleaned forked blocks between ${firstNonForkedBlock} and ${lastDbBlock.block_id}`)
    }

    async main(){
        let startTime = Date.now();

        let lastDbBlock = await this.db.getLastBlock();
        if(lastDbBlock === false)
            return;

        let nowBlock = await this.rpc.getNowBlock();
        let nowBlockHeader = nowBlock.getBlockHeader().toObject();
        let nowBlockId = nowBlockHeader.rawData.number;

        if (lastDbBlock.length == 0){
            //no blocks in the database
            await this.loadBlocksBetween(0, nowBlockId)
        }else{
            lastDbBlock = lastDbBlock[0];
            let lastValidBlockId = await this.cleanForkedDbBlocks(lastDbBlock);
            let nextBlockId = lastValidBlockId + 1;
            if(nextBlockId < nowBlockId){
                await this.loadBlocksBetween(nextBlockId, nowBlockId);
            }
            //console.log(lastDbBlock);
        }

        let timeSpent = Date.now() - startTime;
        let nextMain = 1000 - timeSpent;
        if(nextMain < 0)
            nextMain = 0;
        setTimeout(()=>{
           this.main();
        },nextMain);
    }
}
