import {Project, Derivative, UserHolding, Lock } from "../types";
import { AcalaEvmEvent, AcalaEvmCall } from '@subql/acala-evm-processor';
import { BigNumber } from "ethers";

type ProjectInfo = [string, string, string, string, string, BigNumber] & { 
    name: string; 
    tokenAddress: string; 
    tokenTicker: string; 
    documentHash: string; 
    creator: string; 
    tokenDecimal:BigNumber; 
};
type CreateVest = [string,string,string,BigNumber,BigNumber,string,string, Boolean] & {
    assetAddress: string;
    creator: string;
    userAddress: string;
    userAmount: BigNumber;
    unlockTime: BigNumber;
    wrappedERC20Address: string;
    wrappedAssetTicker: string;
    transferable: Boolean;
};
type CreateVestLock = [BigNumber,string,string,string,BigNumber,BigNumber] & {
    vestID: BigNumber;
    assetAddress: string;
    creator: string;
    userAddress: string;
    userAmount: BigNumber;
    unlockTime: BigNumber;
};
type WithdrawController = [string,BigNumber,string] & {
    userAddress: string;
    amount: BigNumber;
    wrappedTokenAddress: string;
};
type WithdrawVesting = [BigNumber,string,BigNumber,string,BigNumber] & {
  vestID: BigNumber;
  userAddress: string;
  amount: BigNumber;
  wrappedTokenAddress: string;
  unlockTime: BigNumber;
};
type TransferWrapped = [string,string,string,BigNumber] & {
  userAddress: string;
  wrappedTokenAddress: string;
  receiverAddress: string;
  amount: BigNumber;
};

function generateID(_user: string, _ticker: string): string {
    return _user.concat("-LOCK-").concat(_ticker);
  }

export async function handleProjectInfo(event: AcalaEvmEvent<ProjectInfo>): Promise<void> {
    let _projectName = event.args.name.toString();
    let _projectTokenAddress = event.args.tokenAddress.toString();
    let _projectTokenTicker = event.args.tokenTicker.toString();
    let _projectDocHash = event.args.documentHash.toString();
    let _projectOwner = event.args.creator.toString();
    let _projectDecimal = event.args.tokenDecimal.toBigInt();

    let _projectID = generateID(_projectOwner,_projectTokenAddress);

    let project = await Project.get(_projectID);
    if(project === undefined) {
        project = new Project(_projectID);
        project.projectOwnerAddress = _projectOwner;
        project.projectName = _projectName;
        project.projectTokenAddress = _projectTokenAddress;
        project.projectTokenTicker = _projectTokenTicker;
        project.projectDocHash = _projectDocHash;
        project.projectTokenDecimal = _projectDecimal;
    }
    project.save();
}

export async function handleCreateVest(event: AcalaEvmEvent<CreateVest>): Promise<void> {
    // Getting all the required data from the Event.
    let _userAddress = event.args.userAddress.toString();
    let _projectCreator = event.args.creator.toString();
    let _projectAddress = event.args.assetAddress.toString();
    let _tokenAmount = event.args.userAmount.toBigInt();
    let _unlockTime = event.args.unlockTime.toBigInt();
    let _wrappedTokenAddress = event.args.wrappedERC20Address.toString();
    let _wrappedTokenTicker = event.args.wrappedAssetTicker.toString();

     // Generting a Unique Project ID, i.e. a combination of Project Creator & Project Address
    let _projectID = generateID(_projectCreator, _projectAddress);
    let project = await Project.get(_projectID);
    if(project) {
        // If the project exists. Check the corresponding derivative asset exists or not.
        let derivative = await Derivative.get(_wrappedTokenAddress);
        if(!derivative) {
            // If the derivative asset doesn't exist, create one.
            derivative = new Derivative(_wrappedTokenAddress);
            derivative.wrappedTokenTicker = _wrappedTokenTicker;
            derivative.totalSupply = BigInt(0);
            derivative.unlockTime = _unlockTime;
            derivative.projectId = project.id.toString();
            await derivative.save();
        }
        
        // Increase the Total Supply of the Derivative Asset.
        let derivativeSupply = derivative.totalSupply;
        derivative.totalSupply = derivativeSupply + _tokenAmount;

        // Creating a unique User ID, i.e. a combination of the User Address & the Wrapped Asset Address.
        let userHoldingsID = generateID(_userAddress, _wrappedTokenAddress);

        // Checking if the User already exists w.r.t the Wrapped Asset
        let userHoldings = await UserHolding.get(userHoldingsID);
        if (!userHoldings){
            // If the User doesn't exist, create one.
            userHoldings = new UserHolding(userHoldingsID);
            userHoldings.amount = BigInt(0);
            userHoldings.address = _userAddress;
            userHoldings.derivativeId = derivative.id.toString();
        }
        // Increase the Wrapped Asset Holdings of the User.
        let userTokenAmount = userHoldings.amount;
        userHoldings.amount = userTokenAmount + _tokenAmount;
        await userHoldings.save();
        await derivative.save();
    }
}

export async function handleWithdraw(event: AcalaEvmEvent<WithdrawController>): Promise<void>{
    // Getting all the required data from the Event.
  let _userAddress = event.args.userAddress.toString();
  let _amount = event.args.amount.toBigInt();
  let _wrappedTokenAddress = event.args.wrappedTokenAddress.toString();

  // Loading the Derivative Asset.
  let derivative = await Derivative.get(_wrappedTokenAddress);
  if(derivative){
    // Decreasing the Total Supply of the Derivative Asset.
    let derivativeTotalSupply = derivative.totalSupply;
    derivative.totalSupply = derivativeTotalSupply - _amount;

    // Creating a unique User ID, i.e. a combination of the User Address & the Wrapped Asset Address.
    let userID = generateID(_userAddress, _wrappedTokenAddress);

    // Retrieving the User w.r.t the Wrapped Asset
    let userHoldings = await UserHolding.get(userID);
    if(userHoldings){
      // Updating the Balance of User Address
      let userTokenAmount = userHoldings.amount;
      userHoldings.amount = userTokenAmount - _amount;
      await userHoldings.save();
    }
    await derivative.save();
  }
}

export async function handleTransferWrapped(event: AcalaEvmEvent<TransferWrapped>): Promise<void>{
  // Getting all the required data from the Event.
let _userAddress = event.args.userAddress.toString();
let _wrappedTokenAddress = event.args.wrappedTokenAddress.toString();
let _receiverAddress = event.args.receiverAddress.toString();
let _transferAmount = event.args.amount.toBigInt();

// Check the corresponding derivative asset exists or not.
if (_receiverAddress.toLocaleLowerCase() != "0x2a9BD11ddc1a10bbdA5c0362ae321F42b27142b4".toLocaleLowerCase()){
  let derivative = await Derivative.get(_wrappedTokenAddress);
  if(derivative){
    // Creating a unique User ID, i.e. a combination of the User Address & the Wrapped Asset Address.
    let senderID = generateID(_userAddress, _wrappedTokenAddress);

    // Retrieving the User w.r.t the Wrapped Asset
    let senderUserHoldings = await UserHolding.get(senderID);
    if(senderUserHoldings){
      // Updating the Balance of Sender Address
      let senderTokenAmount = senderUserHoldings.amount;
      senderUserHoldings.amount = senderTokenAmount - _transferAmount;
      await senderUserHoldings.save();

      // Creating a unique User ID, i.e. a combination of the User Address & the Wrapped Asset Address.
      let receiverID = generateID(_receiverAddress, _wrappedTokenAddress);

      // Checking if the User already exists w.r.t the Wrapped Asset
      let receiverUserHoldings = await UserHolding.get(receiverID);
      if (!receiverUserHoldings){
        // If the User doesn't exist, create one.
        receiverUserHoldings = new UserHolding(receiverID);
        receiverUserHoldings.address = _receiverAddress;
        receiverUserHoldings.amount = BigInt(0);
        receiverUserHoldings.derivativeId = derivative.id.toString();
      }

      // Updating the Balance of Receiver Address
      let receiverTokenAmount = receiverUserHoldings.amount;
      receiverUserHoldings.amount = receiverTokenAmount + _transferAmount;
      await receiverUserHoldings.save();
    }
    await derivative.save();
  }
}
}

export async function handleCreateVestLock(event: AcalaEvmEvent<CreateVestLock>): Promise<void>{
  // Getting all the required data from the Event.
  let _userAddress = event.args.userAddress.toString();
  let _projectCreator = event.args.creator.toString();
  let _projectAddress = event.args.assetAddress.toString();
  let _tokenAmount = event.args.userAmount.toBigInt();
  let _unlockTime = event.args.unlockTime.toBigInt();
  let _vestID = event.args.vestID.toBigInt();

  // Generting a Unique Project ID, i.e. a combination of Project Creator & Project Address
  let _projectID = generateID(_projectCreator, _projectAddress);

  // Checking if the project already exists.
  let project = await Project.get(_projectID);
  if(project) {
    // Creating a unique Lock ID, i.e. a combination of the ProjectID & VestID.
    let _lockID = generateID(_projectAddress,_vestID.toString());

    // If the project exists. Check the corresponding Lock exists or not.
    let lock = await Lock.get(_lockID);
    if(!lock) {
      // If the Lock doesn't exist, create one.
      lock = new Lock(_lockID);
      lock.address = _userAddress;
      lock.tokenAmount = _tokenAmount;
      lock.unlockTime = _unlockTime;
      lock.vestID = _vestID;
      lock.projectId = project.id.toString();
    }
    await lock.save();
  }
  await project.save();
} 

export async function handleWithdrawLock(event: AcalaEvmEvent<WithdrawVesting>): Promise<void> {
  // Getting all the required data from the Event.
  let _userAddress = event.args.userAddress.toString();
  let _amount = event.args.amount.toBigInt();
  let _wrappedTokenAddress = event.args.wrappedTokenAddress.toString();
  let _unlockTime = event.args.unlockTime.toBigInt();
  let _vestID = event.args.vestID.toBigInt();

  // Creating a unique Lock ID, i.e. a combination of the Asset Address & VestID.
  let _userID = generateID(_wrappedTokenAddress, _vestID.toString());

  // Loading the Lock Asset.
  let lock = await Lock.get(_userID);
  if (lock) {
    if(lock.unlockTime === _unlockTime && lock.address === _userAddress){
      let amount = lock.tokenAmount;
      lock.tokenAmount = amount - _amount;
    }
  }
  await lock.save();
}