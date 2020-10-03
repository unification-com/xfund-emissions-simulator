const bech32 = require("bech32")
const fetch = require("node-fetch")

let VALSET = []
const ENTRY_MULTIPLIER=10000
const DEFAULT_FOR_ZERO=1
const NUM_EMISSIONS=24
let accumulated = {}

const getDelegatorAddress = (operatorAddr) => {
    const address = bech32.decode(operatorAddr)
    return bech32.encode("und", address.words)
}

const getValidators = async () => {
    const url = new URL("https://rest.unification.io/staking/validators?limit=100")
    const valset = []

    const response = await fetch(url)

    const lcdValset = await response.json()

    for (let i = 0; i < lcdValset.result.length; i += 1) {
        const valData = {}
        const val = lcdValset.result[i]

        if(!val.jailed) {
            valData.moniker = val.description.moniker
            valData.operatorAddress = val.operator_address
            valData.consensusPubkey = val.consensus_pubkey
            valData.selfDelegateAddress = getDelegatorAddress(val.operator_address)
            valData.status = val.status
            valData.shares = val.delegator_shares
            valData.tokens = val.tokens

            valset.push(valData)
        }
    }

    console.log("validator set", valset)

    return valset
}

const getTotal = (data) => {
    let total = 0
    Object.keys(data).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const num = Number(data[key])
            if (num > 0) {
                total += num
            }
        }
    })
    console.log("total tokens", total)
    return total
}

const normaliseProportionally = (data) => {
    const normalisedData = {}
    const total = getTotal(data)
    Object.keys(data).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const num = Number(data[key])
            normalisedData[key] = num / total
        }
    })
    console.log("normalisedData", normalisedData)
    return normalisedData
}

const getEntries = (data) => {
    const entries = {}
    Object.keys(data).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const num = Number(data[key])
            let e = num * ENTRY_MULTIPLIER
            if (e < 1) {
                e = DEFAULT_FOR_ZERO
            }
            entries[key] = Math.round(e)
        }
    })
    console.log("entries", entries)
    return entries
}

const assignEntries = (data) => {
    const entries = []
    Object.keys(data).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const num = Number(data[key])
            for (let i = 0; i < num; i += 1) {
                entries.push(key)
            }
        }
    })
    console.log("total entries", entries.length)
    return entries
}

const shuffleTickets = (tickets) => {
    const ticketsShuffle = [...tickets]
    let currentIndex = ticketsShuffle.length
    let temporaryValue
    let randomIndex

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1

        // And swap it with the current element.
        temporaryValue = ticketsShuffle[currentIndex]
        ticketsShuffle[currentIndex] = ticketsShuffle[randomIndex]
        ticketsShuffle[randomIndex] = temporaryValue
    }

    return ticketsShuffle
}

const getRandomEmission = (tickets) => {
    return Math.round(Math.random() * (tickets.length - 1))
}

const loadData = () => {
    const vals = {}

    for (let i = 0; i < VALSET.length; i += 1) {
        const v = VALSET[i]
        vals[v.moniker] = v.tokens
    }

    return vals
}

const generateEmissions = () =>  {

    const emLogs = {}
    const dateNow = new Date()

    // log
    emLogs.emission_date = dateNow

    document.getElementById("entry_multiplier").innerText = ENTRY_MULTIPLIER.toString()
    document.getElementById("default_for_zero").innerText = DEFAULT_FOR_ZERO.toString()
    let emissionsBody = document.getElementById("emissions_body")
    let emissionsRes = document.getElementById("emissions_res_body")
    let accumulatedEmissionsBody = document.getElementById("accumulated_emissions")
    let emLogsContainer = document.getElementById("em_logs")

    emissionsBody.innerHTML = ''
    emissionsRes.innerHTML = ''
    accumulatedEmissionsBody.innerHTML = ''
    emLogsContainer.value = ''

    // log
    emLogs.num_emissions = NUM_EMISSIONS

    const entrants = loadData()

    // log
    emLogs.entrants = entrants

    let norm
    let entries
    let emissionTickets
    let emissionTicketsShuffled
    let totalActiveStakes
    let allocationsDisplay = []

    if (Object.keys(entrants).length > 0) {
        totalActiveStakes = getTotal(entrants)
        norm = normaliseProportionally(entrants)
        entries = getEntries(norm)
        emissionTickets = assignEntries(entries)
        emissionTicketsShuffled = shuffleTickets(emissionTickets)
        // log
        emLogs.total_active_stakes = totalActiveStakes
        emLogs.norm = norm
        emLogs.entries = entries
        emLogs.emission_tickets = emissionTickets
        emLogs.emission_tickets_shuffled = emissionTicketsShuffled
        emLogs.allocations = []

        for (let i = 1; i <= NUM_EMISSIONS; i += 1) {
            const randNumber = getRandomEmission(emissionTicketsShuffled)
            const validatorMoniker = emissionTicketsShuffled[randNumber]

            let alloc = {
                em: i,
                arr_idx: randNumber,
                val: validatorMoniker
            }

            emLogs.allocations.push(alloc)

            if(validatorMoniker in accumulated) {
                accumulated[validatorMoniker] = accumulated[validatorMoniker] + 1
            } else {
                accumulated[validatorMoniker] = 1
            }

            allocationsDisplay.push(alloc)
        }
    }

    console.log(accumulated)

    let totalStake = 0
    let totalProportion = 0
    let totalEntries = 0
    let totalProb = 0
    for (const property in entries) {
        totalEntries = totalEntries + entries[property]
    }

    const formatter = new Intl.NumberFormat('en-US')

    Object.keys(entries).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(entries, key)) {
            let stake = formatter.format(entrants[key])
            totalStake = totalStake + Number(entrants[key])
            let normalised = norm[key]
            totalProportion = totalProportion + normalised
            let numEntries = entries[key]
            let probability = (numEntries / totalEntries) * 100
            totalProb = totalProb + probability
            let html = '<tr><td>' + key + '</td><td>' + stake + '</td><td>' + normalised + '</td><td>' + numEntries + '</td><td>' + probability.toFixed(2) + '%</td></tr>'
            emissionsBody.innerHTML += html
        }
    })

    let html = '<tr><td></td><td><strong>' + formatter.format(totalStake) + '</strong></td><td><strong>' + Math.round(totalProportion) + '</strong></td><td><strong>' + totalEntries + '</strong></td><td><strong>' + totalProb.toFixed(2) + '%</strong></td></tr>'

    emissionsBody.innerHTML += html

    document.getElementById("total_entries").innerText = totalEntries
    document.getElementById("total_entries1").innerText = totalEntries - 1

    for(let j = 0; j < allocationsDisplay.length; j += 1) {
        const alloc = allocationsDisplay[j]
        let html = '<tr><td>' + alloc.em + '</td><td>' + alloc.arr_idx + '</td><td>' + alloc.val + '</td></tr>'
        emissionsRes.innerHTML += html
    }

    Object.keys(accumulated).forEach((key) => {
        console.log(key)
        let html = '<tr><td>' + key + '</td><td>' + accumulated[key] + '</td></tr>'
        accumulatedEmissionsBody.innerHTML += html
    })

    emLogsContainer.value = JSON.stringify(emLogs)
}

window.onload = async function() {
    VALSET = await getValidators()
    generateEmissions()
    let rerunBtn = document.getElementById("rerun")
    rerunBtn.addEventListener("click", function() {
        console.log("click")
        generateEmissions()
    })
}
