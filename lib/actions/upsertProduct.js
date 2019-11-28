/* eslint no-param-reassign: "off" */

/**
 * Copyright 2019 Wice GmbH
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

const Q = require('q');
const { getToken } = require('./../utils/silvererp');
const request = require('request-promise').defaults({ simple: false, resolveWithFullResponse: true });
const uri = 'http://yq.dyndns.org/SilvERP-OIH/index.php?rest&oih&rt=RestOih&command=upsertPerson';

/**
 * This method will be called from OIH platform providing following data
 *
 * @param {Object} msg - incoming message object that contains ``body`` with payload
 * @param {Object} cfg - configuration that is account information and configuration field values
 */
async function processAction(msg, cfg) {
	const token = await getToken(cfg);
	const self = this;
	const oihUid = (msg.body.meta !== undefined && msg.body.meta.oihUid !== undefined) ? msg.body.meta.oihUid : 'oihUid not set yet';
	const recordUid = (msg.body !== undefined && msg.body.uid !== undefined) ? msg.body.uid : 'uid not set yet';
	const iamToken = (msg.body.meta !== undefined && msg.body.meta.iamToken !== undefined) ? msg.body.meta.iamToken : undefined;

	async function emitData() {
		let applicationUid;
		// Make a request to Component repository to fetch the applicationUid
		const getApplicationUidOptions = {
			uri: `http://component-repository.openintegrationhub.com/components/${process.env.ELASTICIO_COMP_ID}`,
			json: true,
			headers: {
				Authorization: `Bearer ${iamToken}`,
			},
		};

		// Make request to Component Repository API
		if (iamToken) {
			const applicationUidResponse = await request.get(getApplicationUidOptions);
			applicationUid = applicationUidResponse.data.applicationUid; // eslint-disable-line
		}

		/** Create an OIH meta object which is required
		* to make the Hub and Spoke architecture work properly
		*/

		const newElement = {};
		const oihMeta = {
			applicationUid: (applicationUid !== undefined || applicationUid !== null) ? applicationUid : 'applicationUid not set yet',
			oihUid,
			recordUid,
		};

		let objectExists = false;

		// Upsert the object depending on 'objectExists' property
		//const reply = await upsertObject(personObject, token, objectExists, 'person', msg.body.meta);

		let method;
		method = 'POST';

		const options = {
			method,
			uri,
			json: true,
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: msg.body.data,
		};

		const reply = await request(options);
		console.log(reply.data.payload.miau);
		if (objectExists) {
			const result = [];
			reply.forEach((elem) => {
				delete elem.payload.uid;
				result.push(elem);
			});
			newElement.meta = oihMeta;
			newElement.data = result;
		} else {
			oihMeta.recordUid = "miau";
			//delete reply.payload.uid;
			newElement.meta = oihMeta;
			newElement.data = reply.payload;
		}

		self.emit('data', newElement);
	}

	/**
	 * This method will be called from OIH platform if an error occured
	 *
	 * @param e - object containg the error
	 */
	function emitError(e) {
		console.log('Oops! Error occurred');
		self.emit('error', e);
	}

	/**
	 * This method will be called from OIH platform
	 * when the execution is finished successfully
	 *
	 */
	function emitEnd() {
		console.log('Finished execution');
		self.emit('end');
	}

	Q()
		.then(emitData)
		.fail(emitError)
		.done(emitEnd);
}

module.exports = {
	process: processAction,
};
